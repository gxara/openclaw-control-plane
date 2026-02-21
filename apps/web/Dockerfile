FROM node:22-alpine AS builder
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY apps/web/package.json apps/web/tsconfig.json apps/web/vite.config.ts ./
COPY apps/web/index.html ./
COPY apps/web/src ./src

RUN pnpm install --no-frozen-lockfile
RUN pnpm exec vite build

FROM nginx:alpine
COPY --from=builder /app/dist /usr/share/nginx/html
COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
