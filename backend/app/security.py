from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Cookie, HTTPException, status

from .config import get_settings

settings = get_settings()
COOKIE_NAME = "session"
ALGORITHM = "HS256"


def verify_admin_password(login: str, password: str) -> bool:
    if login != settings.admin_login:
        return False
    return bcrypt.checkpw(password.encode(), settings.admin_password_hash.encode())


def create_session_token() -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.access_token_expire_minutes)
    payload = {"sub": settings.admin_login, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm=ALGORITHM)


def get_current_admin(session: str | None = Cookie(default=None)) -> str:
    if session is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Не авторизован")
    try:
        payload = jwt.decode(session, settings.secret_key, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Сессия недействительна")
    return payload.get("sub")
