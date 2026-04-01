# syntax=docker/dockerfile:1.6
#
# Multi-stage build for the vibe-kanban HOST server.
# The HOST connects to the relay-server and executes tasks on behalf of
# remote browser sessions.
#
# Build args (all optional — can also be set as runtime env vars):
#   VK_SHARED_API_BASE        URL of the remote-server  (e.g. https://app.example.com)
#   VK_SHARED_RELAY_API_BASE  URL of the relay-server   (e.g. https://relay.example.com)
#   VITE_SENTRY_DSN           Optional Sentry DSN for the embedded frontend

ARG VITE_SENTRY_DSN=""

# ─── Stage 1: Build the embedded local-web frontend ───────────────────────
FROM node:20-alpine AS fe-builder
ARG VITE_SENTRY_DSN

WORKDIR /repo
ENV VITE_SENTRY_DSN=${VITE_SENTRY_DSN}

RUN corepack enable

# Install deps (cached unless lockfile changes)
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/local-web/package.json packages/local-web/package.json
COPY packages/remote-web/package.json packages/remote-web/package.json
COPY packages/ui/package.json packages/ui/package.json
COPY packages/web-core/package.json packages/web-core/package.json
COPY patches/ patches/

RUN --mount=type=cache,id=pnpm,target=/pnpm/store \
    pnpm install --frozen-lockfile

COPY packages/local-web/ packages/local-web/
COPY packages/public/ packages/public/
COPY packages/ui/ packages/ui/
COPY packages/web-core/ packages/web-core/
COPY shared/ shared/

RUN pnpm -C packages/local-web build

# ─── Stage 2: Build the Rust server binary ────────────────────────────────
FROM rust:1.93-slim-bookworm AS builder

ARG VK_SHARED_API_BASE=""
ARG VK_SHARED_RELAY_API_BASE=""

ENV CARGO_REGISTRIES_CRATES_IO_PROTOCOL=sparse
ENV CARGO_NET_GIT_FETCH_WITH_CLI=true
ENV CARGO_TARGET_DIR=/app/target
ENV SQLX_OFFLINE=true
# Bake API base URLs into the binary at compile time (can still be overridden
# at runtime via environment variables)
ENV VK_SHARED_API_BASE=${VK_SHARED_API_BASE}
ENV VK_SHARED_RELAY_API_BASE=${VK_SHARED_RELAY_API_BASE}

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       pkg-config libssl-dev ca-certificates git openssh-client \
       # cmake + nasm: required by aws-lc-sys (crypto used by rustls/TLS)
       cmake nasm \
       # libgit2-dev: lets git2 crate link system libgit2 instead of building from source
       libgit2-dev \
       # clang: needed by aws-lc-sys for bindgen on some platforms
       clang \
  && mkdir -p -m 0700 /root/.ssh \
  && ssh-keyscan github.com >> /root/.ssh/known_hosts \
  && chmod 600 /root/.ssh/known_hosts \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY rust-toolchain.toml ./
RUN cargo --version >/dev/null

COPY Cargo.toml Cargo.lock ./

# Workspace member whose source is not needed for the server binary —
# copy only the manifest so Cargo can resolve workspace metadata.
COPY crates/tauri-app/Cargo.toml crates/tauri-app/Cargo.toml

# Full source for the server and every transitive workspace dependency
COPY crates/api-types         crates/api-types
COPY crates/relay-types       crates/relay-types
COPY crates/relay-tunnel-core crates/relay-tunnel-core
COPY crates/relay-client      crates/relay-client
COPY crates/relay-control     crates/relay-control
COPY crates/relay-ws          crates/relay-ws
COPY crates/relay-webrtc      crates/relay-webrtc
COPY crates/relay-protocol    crates/relay-protocol
COPY crates/relay-hosts       crates/relay-hosts
COPY crates/client-info       crates/client-info
COPY crates/remote-info       crates/remote-info
COPY crates/trusted-key-auth  crates/trusted-key-auth
COPY crates/mcp               crates/mcp
COPY crates/db                crates/db
COPY crates/executors         crates/executors
COPY crates/services          crates/services
COPY crates/worktree-manager  crates/worktree-manager
COPY crates/ws-bridge         crates/ws-bridge
COPY crates/workspace-manager crates/workspace-manager
COPY crates/utils             crates/utils
COPY crates/git               crates/git
COPY crates/git-host          crates/git-host
COPY crates/local-deployment  crates/local-deployment
COPY crates/deployment        crates/deployment
COPY crates/review            crates/review
COPY crates/embedded-ssh      crates/embedded-ssh
COPY crates/desktop-bridge    crates/desktop-bridge
COPY crates/preview-proxy     crates/preview-proxy
COPY crates/server            crates/server

# The server uses rust-embed to bake the frontend into the binary at
# compile time — place the dist where crates/server/build.rs expects it.
COPY --from=fe-builder /repo/packages/local-web/dist packages/local-web/dist

# Also copy asset stubs used by the server build script
COPY assets assets

RUN mkdir -p /app/bin

RUN --mount=type=cache,id=cargo-registry,target=/usr/local/cargo/registry \
    --mount=type=cache,id=cargo-git,target=/usr/local/cargo/git \
    --mount=type=cache,id=server-target,target=/app/target \
    cargo build --locked --release --bin server \
 && cp /app/target/release/server /app/bin/server

# ─── Stage 3: Runtime image ───────────────────────────────────────────────
# Use the official Node.js image so `npx` is available for the Claude Code
# and Codex executors (they are invoked as: npx -y @anthropic-ai/claude-code).
FROM node:20-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
       ca-certificates libssl3 wget curl git git-lfs openssh-client gosu \
  && git lfs install --system \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /home/node/repos /home/node/.vibe-kanban /home/node/.local/share/vibe-kanban \
  && chown -R node:node /home/node

COPY --from=builder /app/bin/server /usr/local/bin/vibe-kanban-server
COPY crates/server/docker-entrypoint.sh /usr/local/bin/vibe-kanban-entrypoint

RUN chmod +x /usr/local/bin/vibe-kanban-entrypoint

USER root

WORKDIR /home/node

# Default runtime configuration — override via docker-compose environment:
#   VK_SHARED_API_BASE / VK_SHARED_RELAY_API_BASE override the compile-time
#   values and are useful when images are built without baked-in URLs.
ENV BACKEND_PORT=3004 \
    RUST_LOG=info \
    HOME=/home/node \
    HOST_AUTO_FIX_OWNERSHIP=1

EXPOSE 3004

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=5 \
  CMD ["wget", "--spider", "-q", "http://127.0.0.1:3004/health"]

ENTRYPOINT ["/usr/local/bin/vibe-kanban-entrypoint"]
CMD ["/usr/local/bin/vibe-kanban-server"]
