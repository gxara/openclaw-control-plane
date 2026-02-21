FROM node:22-alpine
WORKDIR /app
RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml ./
COPY packages/event-schema/package.json ./packages/event-schema/
COPY packages/event-schema/src ./packages/event-schema/src
COPY packages/event-schema/tsconfig.json ./packages/event-schema/
COPY apps/api/package.json apps/api/tsconfig.json ./apps/api/
COPY apps/api/src ./apps/api/src

RUN pnpm install
RUN pnpm run --filter @control-plane/event-schema build
RUN pnpm run --filter api build

WORKDIR /app/apps/api
ENV NODE_ENV=production
EXPOSE 3001
CMD ["node", "dist/index.js"]
