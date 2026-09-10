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
MAX_SOURCE_DIMENSION = 3000
DESKTOP_ASPECT = 16 / 9
MOBILE_ASPECT = 9 / 16


def _get_or_create_content(db: Session) -> SiteContent:
    row = db.query(SiteContent).filter(SiteContent.id == 1).first()
    if row is None:
        row = SiteContent(id=1)
        db.add(row)
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
        hero_source_image=row.hero_source_image,
        hero_mobile_image=row.hero_mobile_image,
        hero_crop_x=row.hero_crop_x,
        hero_crop_y=row.hero_crop_y,
        hero_crop_w=row.hero_crop_w,
        hero_crop_h=row.hero_crop_h,
        hero_mobile_crop_x=row.hero_mobile_crop_x,
        hero_mobile_crop_y=row.hero_mobile_crop_y,
        hero_mobile_crop_w=row.hero_mobile_crop_w,
        hero_mobile_crop_h=row.hero_mobile_crop_h,
    )


def _default_crop(width: int, height: int, aspect: float) -> tuple[float, float, float, float]:
    """The largest aspect-ratio rectangle that fits fully inside the photo,
    centered — i.e. the same starting frame a photo app shows before you
    touch the crop handles."""
    image_aspect = width / height
    if image_aspect > aspect:
        crop_h = 1.0
        crop_w = aspect / image_aspect
    else:
        crop_w = 1.0
        crop_h = image_aspect / aspect
    return (1 - crop_w) / 2, (1 - crop_h) / 2, crop_w, crop_h


def _normalize_and_save(contents: bytes) -> tuple[str, int, int]:
    """Correct EXIF rotation, downscale very large photos, and save as an
    optimized JPEG. No cropping happens here — the full frame is kept so the
    admin can choose the crop rectangle against the complete photo."""
    try:
        with Image.open(BytesIO(contents)) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            width, height = image.size
            longest = max(width, height)
            if longest > MAX_SOURCE_DIMENSION:
                scale = MAX_SOURCE_DIMENSION / longest
                width = max(1, int(round(width * scale)))
                height = max(1, int(round(height * scale)))
                image = image.resize((width, height), Image.Resampling.LANCZOS)
            out_name = f"hero_source_{uuid.uuid4().hex}.jpg"
            out_path = os.path.join(settings.media_dir, out_name)
            os.makedirs(settings.media_dir, exist_ok=True)
            image.save(out_path, "JPEG", quality=92, optimize=True)
            return f"/media/{out_name}", width, height
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Не удалось обработать изображение: {exc}") from exc


def _crop_and_save(source_url: str, crop_x: float, crop_y: float, crop_w: float, crop_h: float, prefix: str) -> str:
    filename = source_url.rsplit("/", 1)[-1]
    source_path = os.path.join(settings.media_dir, filename)
    if not os.path.isfile(source_path):
        raise HTTPException(status_code=400, detail="Исходное изображение не найдено")

    try:
        with Image.open(source_path) as opened:
            image = ImageOps.exif_transpose(opened).convert("RGB")
            width, height = image.size

            left = max(0, min(width - 1, int(round(crop_x * width))))
            top = max(0, min(height - 1, int(round(crop_y * height))))
            crop_w_px = max(1, min(width - left, int(round(crop_w * width))))
            crop_h_px = max(1, min(height - top, int(round(crop_h * height))))

            cropped = image.crop((left, top, left + crop_w_px, top + crop_h_px))
            target_w = min(1920, cropped.width)
            target_h = max(1, int(round(target_w * cropped.height / cropped.width)))
            cropped = cropped.resize((target_w, target_h), Image.Resampling.LANCZOS)

            out_name = f"{prefix}_{uuid.uuid4().hex}.jpg"
            out_path = os.path.join(settings.media_dir, out_name)
            cropped.save(out_path, "JPEG", quality=92, optimize=True)
            return f"/media/{out_name}"
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Не удалось обработать изображение: {exc}") from exc


def _generate_crops(row: SiteContent):
    if not row.hero_source_image:
        row.hero_image = None
        row.hero_mobile_image = None
        return
    row.hero_image = _crop_and_save(
        row.hero_source_image, row.hero_crop_x, row.hero_crop_y, row.hero_crop_w, row.hero_crop_h, "hero_desktop"
    )
    row.hero_mobile_image = _crop_and_save(
        row.hero_source_image,
        row.hero_mobile_crop_x,
        row.hero_mobile_crop_y,
        row.hero_mobile_crop_w,
        row.hero_mobile_crop_h,
        "hero_mobile",
    )


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
    row.hero_crop_x = data.hero_crop_x
    row.hero_crop_y = data.hero_crop_y
    row.hero_crop_w = data.hero_crop_w
    row.hero_crop_h = data.hero_crop_h
    row.hero_mobile_crop_x = data.hero_mobile_crop_x
    row.hero_mobile_crop_y = data.hero_mobile_crop_y
    row.hero_mobile_crop_w = data.hero_mobile_crop_w
    row.hero_mobile_crop_h = data.hero_mobile_crop_h

    if row.hero_source_image:
        _generate_crops(row)

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

    source_url, width, height = _normalize_and_save(contents)

    row = _get_or_create_content(db)
    row.hero_source_image = source_url
    row.hero_crop_x, row.hero_crop_y, row.hero_crop_w, row.hero_crop_h = _default_crop(width, height, DESKTOP_ASPECT)
    (
        row.hero_mobile_crop_x,
        row.hero_mobile_crop_y,
        row.hero_mobile_crop_w,
        row.hero_mobile_crop_h,
    ) = _default_crop(width, height, MOBILE_ASPECT)
    _generate_crops(row)
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
