from sqlalchemy import Column, DateTime, Float, Integer, String, Text, func

from .database import Base


class Application(Base):
    """Заявки с сайта."""

    __tablename__ = "applications"

    id = Column(Integer, primary_key=True, index=True)
    name_encrypted = Column(Text, nullable=False)
    phone_encrypted = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), index=True)


class SiteContent(Base):
    """Редактируемое содержимое главной страницы."""

    __tablename__ = "site_content"

    id = Column(Integer, primary_key=True, default=1)
    title = Column(String(300), nullable=False, default="Реабилитационный центр «Второе дыхание»")
    description = Column(Text, nullable=False, default="Помогаем вернуться к устойчивой и самостоятельной жизни.")
    description_2 = Column(Text, nullable=False, default="")
    description_3 = Column(Text, nullable=False, default="")
    quotes_json = Column(Text, nullable=False, default="[]")
    hero_image = Column(String(300), nullable=True)
    hero_source_image = Column(String(300), nullable=True)
    hero_mobile_image = Column(String(300), nullable=True)
    # Crop rectangle as fractions (0..1) of the full source photo:
    # x/y = top-left corner, w/h = size. Desktop keeps a 16:9 rectangle,
    # mobile keeps a 9:16 rectangle — the admin panel enforces the ratio
    # while letting the rectangle be freely moved/resized over the photo,
    # like a standard photo-app crop tool.
    hero_crop_x = Column(Float, nullable=False, default=0.0)
    hero_crop_y = Column(Float, nullable=False, default=0.0)
    hero_crop_w = Column(Float, nullable=False, default=1.0)
    hero_crop_h = Column(Float, nullable=False, default=1.0)
    hero_mobile_crop_x = Column(Float, nullable=False, default=0.0)
    hero_mobile_crop_y = Column(Float, nullable=False, default=0.0)
    hero_mobile_crop_w = Column(Float, nullable=False, default=1.0)
    hero_mobile_crop_h = Column(Float, nullable=False, default=1.0)


class Contacts(Base):
    """Единственная строка с контактами."""

    __tablename__ = "contacts"

    id = Column(Integer, primary_key=True, default=1)
    phone = Column(String(50), nullable=False, default="+7 (993) 030-00-44")
    email = Column(String(200), nullable=False, default="vtoroe.dyhanie.centr@gmail.com")
    vk = Column(String(300), nullable=False, default="https://m.vk.ru/vtoroe_dyhanie_centr")
    instagram = Column(String(200), nullable=False, default="vtoroe_dyhanie_centr")
