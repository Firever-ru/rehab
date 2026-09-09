"""Шифрование персональных данных (имя/телефон) перед записью в БД.

DATA_ENCRYPTION_KEY должен быть сгенерирован один раз и храниться только в .env:
    python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
"""
from cryptography.fernet import Fernet, InvalidToken

from .config import get_settings

_settings = get_settings()
_fernet = Fernet(_settings.data_encryption_key.encode())


def encrypt(value: str) -> str:
    return _fernet.encrypt(value.encode()).decode()


def decrypt(value: str) -> str:
    try:
        return _fernet.decrypt(value.encode()).decode()
    except InvalidToken:
        return "•••"
