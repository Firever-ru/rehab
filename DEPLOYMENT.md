# Инструкция по установке на сервер — «Второе дыхание»

Стек: **React (Vite) + FastAPI (Python 3.11) + PostgreSQL + Docker + Nginx + Let's Encrypt**
ОС: **Ubuntu 24.04**, VPS и домен — **reg.ru**, домен: `vtoroedyhaniecenter.ru`

Структура репозитория:
```
vtoroe-dyhanie/
├── frontend/           # React + Vite, Dockerfile собирает статику и раздаёт через nginx (порт 8080 внутри сети)
├── backend/            # FastAPI (app/), Dockerfile запускает uvicorn от непривилегированного пользователя
├── nginx/default.conf  # единственный сервис, торчащий наружу — реверс-прокси + SSL
├── docker-compose.yml
└── .env.example        # скопировать в .env и заполнить
```

---

## 1. Домен и DNS (reg.ru)

1. Купите VPS с Ubuntu 24.04 (от 2 CPU / 4 GB RAM / 40 GB SSD).
2. В настройках домена `vtoroedyhaniecenter.ru` добавьте:
   - `A @ → IP вашего VPS`
   - `A www → IP вашего VPS`
3. Проверьте: `dig vtoroedyhaniecenter.ru`.

---

## 2. Первичная настройка сервера (один раз, под root)

```bash
apt update && apt upgrade -y
apt install -y ufw fail2ban curl git unattended-upgrades
dpkg-reconfigure -plow unattended-upgrades

adduser deploy
usermod -aG sudo deploy
rsync --archive --chown=deploy:deploy ~/.ssh /home/deploy
```

В `/etc/ssh/sshd_config`:
```
PermitRootLogin no
PasswordAuthentication no
```
```bash
systemctl restart sshd

ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

Дальше всё — от пользователя `deploy`, не от root:
```bash
su - deploy
```

---

## 3. Docker

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker deploy
newgrp docker
```

Все процессы внутри контейнеров (nginx, uvicorn) работают от непривилегированных пользователей — это уже настроено в `frontend/Dockerfile` и `backend/Dockerfile`.

---

## 4. Разворачивание кода

```bash
cd /home/deploy
git clone <ваш-репозиторий> vtoroe-dyhanie
cd vtoroe-dyhanie
cp .env.example .env
```

Заполните `.env` реальными секретами (команды генерации — прямо в комментариях файла):
- `SECRET_KEY` — `openssl rand -hex 32`
- `DATA_ENCRYPTION_KEY` — `python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`
- `ADMIN_PASSWORD_HASH` — `python3 -c "import bcrypt; print(bcrypt.hashpw(b'ваш_пароль', bcrypt.gensalt()).decode())"`
- `POSTGRES_PASSWORD` — любой длинный случайный пароль

```bash
chmod 600 .env
```

---

## 5. Первый запуск и SSL-сертификат

Сначала поднимаем всё, кроме финального HTTPS-конфига (в `nginx/default.conf` уже есть challenge-локация на 80 порту):

```bash
docker compose up -d db backend frontend nginx
```

Backend при старте сам создаёт таблицы в PostgreSQL (`Base.metadata.create_all`), миграции не нужны.

Получаем сертификат:
```bash
docker compose run --rm certbot certonly \
  --webroot -w /var/www/certbot \
  -d vtoroedyhaniecenter.ru -d www.vtoroedyhaniecenter.ru \
  --email vtoroe.dyhanie.centr@gmail.com --agree-tos --no-eff-email

docker compose restart nginx
docker compose up -d certbot   # процесс автопродления каждые 12 часов
```

Проверьте: `https://vtoroedyhaniecenter.ru` — сайт, `https://vtoroedyhaniecenter.ru/api/health` — `{"status":"ok"}`.

---

## 6. Безопасность и шифрование данных

- PostgreSQL не публикует порт наружу — доступ только из внутренней docker-сети `internal` (см. `docker-compose.yml`), `backend` в этой сети один.
- Имя и телефон из заявок шифруются на уровне приложения (`backend/app/crypto.py`, Fernet) перед записью в БД — при утечке дампа номера телефонов не читаются в открытом виде.
- Пароль администратора хранится только как bcrypt-хэш в `.env` (`ADMIN_PASSWORD_HASH`), сравнение — `bcrypt.checkpw`.
- Авторизация — httpOnly + Secure cookie с JWT (12 часов), недоступна из JS → защита от XSS-кражи токена.
- `/api/*` ограничен `limit_req` в nginx (5 запросов/сек с burst 15) — защита от спама формы и перебора логина.
- Все заголовки безопасности (`HSTS`, `X-Frame-Options`, `X-Content-Type-Options`) выставлены в `nginx/default.conf`.

Регулярный бэкап БД (храните вне сервера):
```bash
docker compose exec db pg_dump -U vtoroe_app vtoroe_dyhanie | gzip > backup_$(date +%F).sql.gz
```

---

## 7. Чек-лист перед релизом

- [ ] `.env` заполнен реальными секретами, `chmod 600 .env`, файл не в git
- [ ] `ufw status` — открыты только 22/80/443
- [ ] SSH только по ключу, root-логин отключён
- [ ] `https://vtoroedyhaniecenter.ru` открывается, HTTP редиректит на HTTPS
- [ ] Вход в `/admin/dashboard` без логина редиректит обратно на `/admin`
- [ ] Форма заявки на сайте реально создаёт запись (проверить в админке)
- [ ] Контейнер `certbot` запущен (автопродление)
- [ ] Настроен регулярный бэкап БД

---

## 8. Обновление после изменений в коде

На текущем сервере проект может находиться в `~/rehab`. Если это ваш каталог с клонированным репозиторием:

```bash
cd ~/rehab
git status
git pull origin main
docker compose build frontend backend
docker compose up -d --no-deps frontend backend
```

После обновления проверьте:

```bash
docker compose ps
docker compose logs --tail=100 backend
curl -I https://vtoroedyhaniecenter.ru
curl https://vtoroedyhaniecenter.ru/robots.txt
curl https://vtoroedyhaniecenter.ru/sitemap.xml
```

Если изменения были только во frontend, достаточно пересобрать его:

```bash
docker compose build frontend
docker compose up -d --no-deps frontend
```

Если изменялся backend, пересоберите и перезапустите backend. Новые поля базы данных из этой версии добавляются автоматически при старте backend без удаления существующих данных.

