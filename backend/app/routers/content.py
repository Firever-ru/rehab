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
CROP_ASPECT = 16 / 7


def _get_or_create_content(db: Session) -> SiteContent:
    row = db.query(SiteContent).filter(SiteContent.id == 1).first()
    if row is None:
        row = SiteContent(id=1)
        db.add(row)
        db.commit()
        db.refresh(row)
    if not row.hero_source_image and row.hero_image:
        row.hero_source_image = row.hero_image
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
    return ContentOut(
        title=row.title,
        description=row.description,
        description_2=row.description_2 or "",
        description_3=row.description_3 or "",
        quotes=json.loads(row.quotes_json),
        hero_image=row.hero_image,
        hero_source_image=row.hero_source_image or row.hero_image,
        hero_position_x=row.hero_position_x,
        hero_position_y=row.hero_position_y,
        hero_zoom=row.hero_zoom,
    )


def _crop_and_save(source_url: str, position_x: int, position_y: int, zoom: int) -> str:
    filename = source_url.rsplit("/", 1)[-1]
    source_path = os.path.join(settings.media_dir, filename)
    if not os.path.isfile(source_path):
        raise HTTPException(status_code=400, detail="Исходное изображение не найдено")

    try:
        with Image.open(source_path) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            width, height = image.size
            base_w = width
            base_h = int(round(width / CROP_ASPECT))
            if base_h > height:
                base_h = height
                base_w = int(round(height * CROP_ASPECT))

            zoom_factor = max(1.0, min(2.2, zoom / 100))
            crop_w = max(1, int(round(base_w / zoom_factor)))
            crop_h = max(1, int(round(base_h / zoom_factor)))
            crop_w = min(crop_w, width)
            crop_h = min(crop_h, height)

            max_left = width - crop_w
            max_top = height - crop_h
            left = int(round(max_left * max(0, min(100, position_x)) / 100))
            top = int(round(max_top * max(0, min(100, position_y)) / 100))

            cropped = image.crop((left, top, left + crop_w, top + crop_h))
            target_w = min(1920, cropped.width)
            target_h = int(round(target_w / CROP_ASPECT))
            if target_h > cropped.height:
                target_h = cropped.height
                target_w = int(round(target_h * CROP_ASPECT))
            cropped = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

            out_name = f"hero_cropped_{uuid.uuid4().hex}.jpg"
            out_path = os.path.join(settings.media_dir, out_name)
            cropped.save(out_path, "JPEG", quality=92, optimize=True)
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

    if row.hero_source_image:
        row.hero_image = _crop_and_save(
            row.hero_source_image,
            data.hero_position_x,
            data.hero_position_y,
            data.hero_zoom,
        )

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

    os.makedirs(settings.media_dir, exist_ok=True)
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    filename = f"hero_source_{uuid.uuid4().hex}.{ext}"
    source_url = f"/media/{filename}"
    with open(os.path.join(settings.media_dir, filename), "wb") as f:
        f.write(contents)

    row = _get_or_create_content(db)
    row.hero_source_image = source_url
    row.hero_position_x = 50
    row.hero_position_y = 50
    row.hero_zoom = 100
    row.hero_image = _crop_and_save(source_url, 50, 50, 100)
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
