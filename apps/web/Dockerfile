FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install

FROM node:20-alpine AS builder
WORKDIR /app
# next.config.mjs читает эти переменные при вызове rewrites() — Next.js "запекает"
# результат в сборку во время build, а не при каждом запросе. Поэтому их нужно
# передать именно как build ARG, runtime environment в docker-compose тут не поможет.
ARG API_INTERNAL_URL=http://localhost:8000
ARG MINIO_INTERNAL_URL=http://localhost:9000
ENV API_INTERNAL_URL=$API_INTERNAL_URL
ENV MINIO_INTERNAL_URL=$MINIO_INTERNAL_URL
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# Прод-образ — только собранный билд, без исходников и dev-зависимостей.
# Для локальной разработки с hot-reload apps/web монтируется поверх этого же
# образа как volume, а команда переопределяется на "npm run dev" в docker-compose.yml.
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.mjs ./next.config.mjs

EXPOSE 3000

CMD ["npm", "start"]
