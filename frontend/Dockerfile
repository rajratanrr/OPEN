FROM node:24-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY gateway/package.json gateway/package.json
RUN npm ci --workspace=frontend
COPY frontend frontend
RUN npm run build -w frontend

FROM nginxinc/nginx-unprivileged:1.28-alpine
COPY infra/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/frontend/dist /usr/share/nginx/html
EXPOSE 8080
