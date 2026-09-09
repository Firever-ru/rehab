from fastapi import APIRouter, Depends, HTTPException, Response, status

from ..config import get_settings
from ..schemas import LoginRequest
from ..security import COOKIE_NAME, create_session_token, get_current_admin, verify_admin_password

router = APIRouter(prefix="/api/auth", tags=["auth"])
settings = get_settings()


@router.post("/login")
def login(data: LoginRequest, response: Response):
    if not verify_admin_password(data.login, data.password):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Неверный логин или пароль")

    token = create_session_token()
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=settings.cookie_secure,
        samesite="lax",
        max_age=settings.access_token_expire_minutes * 60,
        path="/",
    )
    return {"status": "ok"}


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie(COOKIE_NAME, path="/")
    return {"status": "ok"}


@router.get("/me")
def me(admin: str = Depends(get_current_admin)):
    return {"login": admin}
