FROM node:20-alpine AS builder
WORKDIR /repo

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json packages/ui/package.json
COPY packages/web-core/package.json packages/web-core/package.json
COPY packages/admin/package.json packages/admin/package.json
COPY patches/ patches/

RUN pnpm install --frozen-lockfile

COPY packages/ui packages/ui
COPY packages/web-core packages/web-core
COPY packages/admin packages/admin
COPY shared shared
COPY packages/local-web/tailwind.new.config.js packages/local-web/tailwind.new.config.js

RUN pnpm --filter @vibe/admin run build

FROM node:20-alpine
WORKDIR /app

COPY services/admin/server.js .
COPY --from=builder /repo/packages/admin/dist ./dist

ENV NODE_ENV=production

# Run as node (UID 1000) so saved credential files are readable by the HOST
# container which also runs as node (UID 1000).
USER node

EXPOSE 3005

CMD ["node", "server.js"]
