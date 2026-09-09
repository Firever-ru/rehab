import json
import os
import uuid

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ..config import get_settings
from ..database import get_db
from ..models import Contacts, SiteContent
from ..schemas import ContactsIn, ContactsOut, ContentIn, ContentOut
from ..security import get_current_admin

router = APIRouter(prefix="/api", tags=["content"])
settings = get_settings()

ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_SIZE = 8 * 1024 * 1024  # 8 MB


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


@router.get("/content", response_model=ContentOut)
def get_content(db: Session = Depends(get_db)):
    row = _get_or_create_content(db)
    return ContentOut(
        title=row.title,
        description=row.description,
        description_2=row.description_2 or "",
        description_3=row.description_3 or "",
        quotes=json.loads(row.quotes_json),
        hero_image=row.hero_image,
        hero_position_x=row.hero_position_x,
        hero_position_y=row.hero_position_y,
        hero_zoom=row.hero_zoom,
    )


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
    db.commit()
    db.refresh(row)
    return ContentOut(
        title=row.title,
        description=row.description,
        description_2=row.description_2 or "",
        description_3=row.description_3 or "",
        quotes=data.quotes,
        hero_image=row.hero_image,
        hero_position_x=row.hero_position_x,
        hero_position_y=row.hero_position_y,
        hero_zoom=row.hero_zoom,
    )


@router.post("/content/hero-image", response_model=ContentOut)
async def upload_hero_image(
    file: UploadFile, db: Session = Depends(get_db), admin: str = Depends(get_current_admin)
):
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Разрешены только JPEG, PNG или WEBP")

    contents = await file.read()
    if len(contents) > MAX_IMAGE_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 8 МБ)")

    os.makedirs(settings.media_dir, exist_ok=True)
    ext = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}[file.content_type]
    filename = f"hero_{uuid.uuid4().hex}.{ext}"
    with open(os.path.join(settings.media_dir, filename), "wb") as f:
        f.write(contents)

    row = _get_or_create_content(db)
    row.hero_image = f"/media/{filename}"
    db.commit()
    db.refresh(row)
    return ContentOut(
        title=row.title,
        description=row.description,
        description_2=row.description_2 or "",
        description_3=row.description_3 or "",
        quotes=json.loads(row.quotes_json),
        hero_image=row.hero_image,
        hero_position_x=row.hero_position_x,
        hero_position_y=row.hero_position_y,
        hero_zoom=row.hero_zoom,
    )


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
