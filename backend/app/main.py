import os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from .config import get_settings
from .database import Base, engine
from sqlalchemy import inspect, text
from .routers import applications, auth, content

settings = get_settings()

app = FastAPI(title="Второе дыхание API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(applications.router)
app.include_router(content.router)

os.makedirs(settings.media_dir, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")


@app.on_event("startup")
def on_startup():
    Base.metadata.create_all(bind=engine)

    # Добавляем новые поля в уже существующую таблицу без потери данных.
    inspector = inspect(engine)
    columns = {column["name"] for column in inspector.get_columns("site_content")}
    migrations = {
        "description_2": "ALTER TABLE site_content ADD COLUMN description_2 TEXT NOT NULL DEFAULT ''",
        "description_3": "ALTER TABLE site_content ADD COLUMN description_3 TEXT NOT NULL DEFAULT ''",
        "hero_source_image": "ALTER TABLE site_content ADD COLUMN hero_source_image VARCHAR(300)",
        "hero_mobile_image": "ALTER TABLE site_content ADD COLUMN hero_mobile_image VARCHAR(300)",
        "hero_crop_x": "ALTER TABLE site_content ADD COLUMN hero_crop_x DOUBLE PRECISION NOT NULL DEFAULT 0",
        "hero_crop_y": "ALTER TABLE site_content ADD COLUMN hero_crop_y DOUBLE PRECISION NOT NULL DEFAULT 0",
        "hero_crop_w": "ALTER TABLE site_content ADD COLUMN hero_crop_w DOUBLE PRECISION NOT NULL DEFAULT 1",
        "hero_crop_h": "ALTER TABLE site_content ADD COLUMN hero_crop_h DOUBLE PRECISION NOT NULL DEFAULT 1",
        "hero_mobile_crop_x": "ALTER TABLE site_content ADD COLUMN hero_mobile_crop_x DOUBLE PRECISION NOT NULL DEFAULT 0",
        "hero_mobile_crop_y": "ALTER TABLE site_content ADD COLUMN hero_mobile_crop_y DOUBLE PRECISION NOT NULL DEFAULT 0",
        "hero_mobile_crop_w": "ALTER TABLE site_content ADD COLUMN hero_mobile_crop_w DOUBLE PRECISION NOT NULL DEFAULT 1",
        "hero_mobile_crop_h": "ALTER TABLE site_content ADD COLUMN hero_mobile_crop_h DOUBLE PRECISION NOT NULL DEFAULT 1",
    }
    with engine.begin() as connection:
        for column, statement in migrations.items():
            if column not in columns:
                connection.execute(text(statement))
        # Old columns from the position+zoom framing system are no longer
        # used — the crop rectangle above replaced them.
        for old_column in (
            "hero_position_x",
            "hero_position_y",
            "hero_zoom",
            "hero_mobile_position_x",
            "hero_mobile_position_y",
            "hero_mobile_zoom",
        ):
            if old_column in columns:
                connection.execute(text(f"ALTER TABLE site_content DROP COLUMN {old_column}"))


@app.get("/health")
def health():
    return {"status": "ok"}
