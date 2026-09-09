from datetime import datetime

from pydantic import BaseModel, Field, field_validator


class ApplicationCreate(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=5, max_length=30)

    @field_validator("name")
    @classmethod
    def name_not_blank(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Укажите имя")
        return v

    @field_validator("phone")
    @classmethod
    def phone_has_digits(cls, v: str) -> str:
        digits = "".join(ch for ch in v if ch.isdigit())
        if len(digits) < 10:
            raise ValueError("Укажите корректный номер телефона")
        return v.strip()


class ApplicationOut(BaseModel):
    id: int
    name: str
    phone: str
    created_at: datetime


class LoginRequest(BaseModel):
    login: str
    password: str


class ContentIn(BaseModel):
    title: str = Field(min_length=1, max_length=300)
    description: str = Field(min_length=1)
    quotes: list[str] = Field(default_factory=list, max_length=20)


class ContentOut(BaseModel):
    title: str
    description: str
    quotes: list[str]
    hero_image: str | None = None


class ContactsIn(BaseModel):
    phone: str = Field(min_length=5, max_length=50)
    email: str = Field(min_length=3, max_length=200)
    vk: str = Field(max_length=300)
    instagram: str = Field(max_length=200)


class ContactsOut(ContactsIn):
    pass
