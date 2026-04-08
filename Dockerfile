FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM build AS version-gen
ARG GIT_COMMIT=unknown
RUN echo "{\"version\":\"0.1.0\",\"commit\":\"${GIT_COMMIT}\",\"buildTime\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}" > /app/dist/version.json

FROM nginx:alpine
COPY --from=version-gen /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --spider -q http://127.0.0.1:80/ || exit 1
