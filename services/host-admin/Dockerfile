FROM node:20-alpine AS builder
WORKDIR /repo

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ui/package.json packages/ui/package.json
COPY packages/web-core/package.json packages/web-core/package.json
COPY packages/host-admin-web/package.json packages/host-admin-web/package.json
COPY patches/ patches/

RUN pnpm install --frozen-lockfile

COPY packages/ui packages/ui
COPY packages/web-core packages/web-core
COPY packages/host-admin-web packages/host-admin-web
COPY shared shared
COPY packages/local-web/tailwind.new.config.js packages/local-web/tailwind.new.config.js

RUN pnpm --filter @vibe/host-admin-web run build

FROM node:20-alpine
WORKDIR /app

COPY services/host-admin/server.js .
COPY --from=builder /repo/packages/host-admin-web/dist ./dist

ENV NODE_ENV=production

# Run as node (UID 1000) so saved credential files are readable by the HOST
# container which also runs as node (UID 1000).
USER node

EXPOSE 3005

CMD ["node", "server.js"]
