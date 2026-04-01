#!/bin/sh
set -eu

AUTO_FIX="${HOST_AUTO_FIX_OWNERSHIP:-1}"
TARGET_USER="${HOST_RUNTIME_USER:-node}"
TARGET_UID="${HOST_RUNTIME_UID:-1000}"
TARGET_GID="${HOST_RUNTIME_GID:-1000}"

ensure_owned() {
  path="$1"
  mkdir -p "$path"

  if [ "$AUTO_FIX" != "1" ]; then
    return 0
  fi

  chown -R "${TARGET_UID}:${TARGET_GID}" "$path"
}

if [ "$(id -u)" -eq 0 ]; then
  ensure_owned /home/node/repos
  ensure_owned /home/node/.vibe-kanban
  ensure_owned /home/node/.local/share/vibe-kanban
  ensure_owned /home/node/.claude
  ensure_owned /home/node/.codex

  exec gosu "$TARGET_USER" "$@"
fi

exec "$@"
