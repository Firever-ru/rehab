from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    postgres_db: str = "vtoroe_dyhanie"
    postgres_user: str = "vtoroe_app"
    postgres_password: str = ""
    postgres_host: str = "db"
    postgres_port: int = 5432

    secret_key: str
    data_encryption_key: str

    admin_login: str
    admin_password_hash: str

    allowed_origins: str = "https://vtoroedyhaniecenter.ru"
    cookie_secure: bool = True

    access_token_expire_minutes: int = 60 * 12  # 12 часов

    media_dir: str = "/app/media"

    @property
    def database_url(self) -> str:
        return (
            f"postgresql+psycopg2://{self.postgres_user}:{self.postgres_password}"
            f"@{self.postgres_host}:{self.postgres_port}/{self.postgres_db}"
        )

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
