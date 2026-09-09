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
        "hero_position_x": "ALTER TABLE site_content ADD COLUMN hero_position_x INTEGER NOT NULL DEFAULT 50",
        "hero_position_y": "ALTER TABLE site_content ADD COLUMN hero_position_y INTEGER NOT NULL DEFAULT 50",
        "hero_zoom": "ALTER TABLE site_content ADD COLUMN hero_zoom INTEGER NOT NULL DEFAULT 100",
    }
    with engine.begin() as connection:
        for column, statement in migrations.items():
            if column not in columns:
                connection.execute(text(statement))


@app.get("/health")
def health():
    return {"status": "ok"}
