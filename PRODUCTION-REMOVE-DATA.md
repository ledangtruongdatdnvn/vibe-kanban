# Production Data Removal

This document describes how to wipe persisted data for the production Docker
stack in this repo.

Warning: these steps are destructive.

- Removing `remote-db-data` deletes cloud data such as users, organizations,
  projects, issues, workspace links, and GitHub App installation records.
- Removing `electric-data` deletes Electric sync state.
- Removing `host-data` deletes host-local state such as `db.v2.sqlite`,
  `config.json`, `credentials.json`, `relay_host_credentials.json`, and logs.
- Removing `claude-credentials` and `codex-credentials` signs the host out of
  those tools.
- Removing `HOST_REPOS_DIR` deletes all cloned repos and worktrees on the host.

## Persisted Data

Current persisted data in the stack:

- `remote-db-data`
- `electric-data`
- `host-data`
- `claude-credentials`
- `codex-credentials`
- `${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}` bind mount

See also:

- [docker-compose.yaml](./docker-compose.yaml)
- [DEPLOYMENT.md](./DEPLOYMENT.md)

## Full Wipe

This removes everything, including cloud data and local host state.

1. Stop the stack.

```bash
docker compose down
```

2. Confirm the current volume names.

If you deployed through Coolify, the volume prefix is usually the resource UUID.
For the current resource shown in previous deploy logs, that prefix is
`ycyuogqfi5rdd6ljzt9yi308`.

```bash
docker volume ls | grep -E 'remote-db-data|electric-data|host-data|claude-credentials|codex-credentials'
```

3. Remove the Docker volumes.

```bash
docker volume rm \
  ycyuogqfi5rdd6ljzt9yi308_remote-db-data \
  ycyuogqfi5rdd6ljzt9yi308_electric-data \
  ycyuogqfi5rdd6ljzt9yi308_host-data \
  ycyuogqfi5rdd6ljzt9yi308_claude-credentials \
  ycyuogqfi5rdd6ljzt9yi308_codex-credentials
```

4. Remove cloned repos on the host.

```bash
rm -rf "${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}"
```

5. Recreate the repo root before the next deploy.

```bash
mkdir -p "${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}"
chown -R 1000:1000 "${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}"
```

## Host-Only Wipe

Use this if you want to keep cloud data in Postgres but reset the local host.

This removes:

- `host-data`
- `claude-credentials`
- `codex-credentials`
- `${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}`

It keeps:

- `remote-db-data`
- `electric-data`

Commands:

```bash
docker compose down
docker volume rm \
  ycyuogqfi5rdd6ljzt9yi308_host-data \
  ycyuogqfi5rdd6ljzt9yi308_claude-credentials \
  ycyuogqfi5rdd6ljzt9yi308_codex-credentials
rm -rf "${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}"
mkdir -p "${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}"
chown -R 1000:1000 "${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}"
```

## Verify Before Redeploy

```bash
docker volume ls | grep -E 'remote-db-data|electric-data|host-data|claude-credentials|codex-credentials'
ls -la "${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}"
```

Expected:

- removed volumes should no longer exist
- repo directory should exist and be empty
