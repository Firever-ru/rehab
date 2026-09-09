import json
import os
import uuid
from io import BytesIO

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session
from PIL import Image, ImageOps

from ..config import get_settings
from ..database import get_db
from ..models import Contacts, SiteContent
from ..schemas import ContactsIn, ContactsOut, ContentIn, ContentOut
from ..security import get_current_admin

router = APIRouter(prefix="/api", tags=["content"])
settings = get_settings()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 8 * 1024 * 1024
# The full (un-cropped) source photo is served to the browser and framed live
# with CSS (object-position + transform: scale), driven by the position/zoom
# values below. We intentionally do NOT crop the photo server-side to a fixed
# 16:9 / 9:16 box anymore: the hero section's on-page box ratio changes with
# viewport size (it's height:clamp(...) + width:100%, not a fixed aspect),
# so a server-side crop to a fixed ratio and a client-side `object-fit`
# re-crop the image twice and never agree with what the admin sees in the
# crop editor. Framing the *source* image live with CSS is what makes the
# admin preview and the live site pixel-for-pixel consistent on any device.
MAX_SOURCE_DIMENSION = 2600


def _get_or_create_content(db: Session) -> SiteContent:
    row = db.query(SiteContent).filter(SiteContent.id == 1).first()
    if row is None:
        row = SiteContent(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    # Backfill for rows created by the old fixed-crop flow: the uncropped
    # source is what we now serve directly, so fall back to whichever image
    # we still have on file.
    if not row.hero_source_image and (row.hero_image or row.hero_mobile_image):
        row.hero_source_image = row.hero_image or row.hero_mobile_image
        db.commit()
        db.refresh(row)
    return row


def _get_or_create_contacts(db: Session) -> Contacts:
    row = db.query(Contacts).filter(Contacts.id == 1).first()
    if row is None:
        row = Contacts(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _content_out(row: SiteContent) -> ContentOut:
    # hero_image is now always the full, uncropped source photo — the
    # frontend frames it live with CSS using the position/zoom fields below.
    # hero_source_image is kept for backward compatibility with any cached
    # frontend build; it mirrors hero_image.
    source = row.hero_source_image
    return ContentOut(
        title=row.title,
        description=row.description,
        description_2=row.description_2 or "",
        description_3=row.description_3 or "",
        quotes=json.loads(row.quotes_json),
        hero_image=source,
        hero_source_image=source,
        hero_mobile_image=source,
        hero_position_x=row.hero_position_x,
        hero_position_y=row.hero_position_y,
        hero_zoom=row.hero_zoom,
        hero_mobile_position_x=row.hero_mobile_position_x,
        hero_mobile_position_y=row.hero_mobile_position_y,
        hero_mobile_zoom=row.hero_mobile_zoom,
    )


def _normalize_and_save(contents: bytes) -> str:
    """Correct EXIF rotation, downscale very large photos, and save as an
    optimized JPEG. The full frame is kept intact — no cropping happens
    here. Cropping/framing is applied live in CSS on the frontend using the
    stored position/zoom values, so the same photo looks correct on any
    screen size and the admin's live preview always matches production."""
    try:
        with Image.open(BytesIO(contents)) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            width, height = image.size
            longest = max(width, height)
            if longest > MAX_SOURCE_DIMENSION:
                scale = MAX_SOURCE_DIMENSION / longest
                image = image.resize(
                    (max(1, int(round(width * scale))), max(1, int(round(height * scale)))),
                    Image.Resampling.LANCZOS,
                )
            out_name = f"hero_source_{uuid.uuid4().hex}.jpg"
            out_path = os.path.join(settings.media_dir, out_name)
            os.makedirs(settings.media_dir, exist_ok=True)
            image.save(out_path, "JPEG", quality=92, optimize=True)
            return f"/media/{out_name}"
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Не удалось обработать изображение: {exc}") from exc


@router.get("/content", response_model=ContentOut)
def get_content(db: Session = Depends(get_db)):
    return _content_out(_get_or_create_content(db))


@router.put("/content", response_model=ContentOut)
def update_content(data: ContentIn, db: Session = Depends(get_db), admin: str = Depends(get_current_admin)):
    row = _get_or_create_content(db)
    row.title = data.title
    row.description = data.description
    row.description_2 = data.description_2
    row.description_3 = data.description_3
    row.quotes_json = json.dumps(data.quotes, ensure_ascii=False)
    row.hero_position_x = data.hero_position_x
    row.hero_position_y = data.hero_position_y
    row.hero_zoom = data.hero_zoom
    row.hero_mobile_position_x = data.hero_mobile_position_x
    row.hero_mobile_position_y = data.hero_mobile_position_y
    row.hero_mobile_zoom = data.hero_mobile_zoom

    db.commit()
    db.refresh(row)
    return _content_out(row)


@router.post("/content/hero-image", response_model=ContentOut)
async def upload_hero_image(
    file: UploadFile, db: Session = Depends(get_db), admin: str = Depends(get_current_admin)
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Разрешены только JPEG, PNG или WEBP")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 8 МБ)")

    try:
        Image.open(BytesIO(contents)).verify()
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Файл не является корректным изображением") from exc

    source_url = _normalize_and_save(contents)

    row = _get_or_create_content(db)
    row.hero_source_image = source_url
    row.hero_position_x = 50
    row.hero_position_y = 50
    row.hero_zoom = 100
    row.hero_mobile_position_x = 50
    row.hero_mobile_position_y = 50
    row.hero_mobile_zoom = 100
    db.commit()
    db.refresh(row)
    return _content_out(row)


@router.get("/contacts", response_model=ContactsOut)
def get_contacts(db: Session = Depends(get_db)):
    row = _get_or_create_contacts(db)
    return ContactsOut(phone=row.phone, email=row.email, vk=row.vk, instagram=row.instagram)


@router.put("/contacts", response_model=ContactsOut)
def update_contacts(data: ContactsIn, db: Session = Depends(get_db), admin: str = Depends(get_current_admin)):
    row = _get_or_create_contacts(db)
    row.phone = data.phone
    row.email = data.email
    row.vk = data.vk
    row.instagram = data.instagram
    db.commit()
    return ContactsOut(**data.model_dump())
