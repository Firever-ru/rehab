# Второе дыхание — сайт реабилитационного центра

React (Vite) + FastAPI + PostgreSQL, всё в Docker.

## Локальная разработка

Backend:
```bash
cd backend
python3.11 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp ../.env.example ../.env   # заполнить, POSTGRES_HOST=localhost если Postgres локально
uvicorn app.main:app --reload
```

Frontend:
```bash
cd frontend
npm install
npm run dev
```
Vite-конфиг уже проксирует `/api` и `/media` на `localhost:8000` (см. `vite.config.js`).

## Продакшен

См. **[DEPLOYMENT.md](./DEPLOYMENT.md)** — полная инструкция по установке на VPS (reg.ru, Ubuntu 24.04, Docker, HTTPS).

## Важно

- Пароль администратора нигде не хранится в открытом виде — только bcrypt-хэш в `.env` (`ADMIN_PASSWORD_HASH`).
- Имя и телефон в заявках шифруются перед записью в БД (`backend/app/crypto.py`).
- Секреты (`.env`) никогда не коммитятся в git.
