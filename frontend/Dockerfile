# ---- build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# ---- serve ----
FROM nginx:1.27-alpine
RUN adduser -D -H -u 1001 webuser \
 && chown -R webuser:webuser /var/cache/nginx /var/run /usr/share/nginx/html \
 && touch /var/run/nginx.pid \
 && chown webuser:webuser /var/run/nginx.pid
COPY --from=build --chown=webuser:webuser /app/dist /usr/share/nginx/html
COPY frontend.nginx.conf /etc/nginx/conf.d/default.conf
USER webuser
EXPOSE 8080
