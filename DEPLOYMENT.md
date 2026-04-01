# Vibe Kanban — Deployment Guide

## Architecture

```
Browser  ──►  remote-server  ──►  relay-server  ──►  HOST container
              (web UI)             (WS tunnel)         (runs AI tasks)
```

- **remote-server**: Web dashboard, auth, database (ElectricSQL)
- **relay-server**: WebSocket tunnel between browser and HOST
- **HOST**: Executes Claude/Codex tasks, manages git worktrees
- **host-admin**: Temporary admin UI for credentials, cleanup, and branch/workspace maintenance (port 3005)

All 4 services run in the same Docker Compose stack on Coolify.

---

## Prerequisites

- Server with Docker + Coolify
- Domain with Cloudflare (e.g. `example.com`)
- GitHub OAuth App
- Claude Pro/Max subscription (or Anthropic API key)

---

## Step 1 — GitHub OAuth App

Go to GitHub → Settings → Developer Settings → OAuth Apps → New OAuth App:

```
Homepage URL:               https://vibe-kanban.example.com
Authorization callback URL: https://vibe-kanban.example.com/v1/oauth/github/callback
```

Note the **Client ID** and **Client Secret**.

---

## Step 2 — Cloudflare

For both `vibe-kanban.example.com` and `relay.example.com`:

1. **SSL/TLS mode**: `Full` (not Flexible) — avoids redirect loops
2. **WebSockets**: Network → WebSockets → **On** — required for relay tunnel

---

## Step 3 — Coolify Setup

### Domains

In **Configuration → General → Domains**:

```
remote-server:  https://vibe-kanban.example.com
relay-server:   https://relay.example.com
electric:       (blank — internal only)
host:           (blank — localhost only, accessed via SSH tunnel)
host-admin:     (assign only when you need the admin console)
```

> `host` should remain internal-only. Expose `host-admin` only when you need it, and protect it with `HOST_ADMIN_SECRET`.

### Environment Variables

In **Configuration → Environment Variables**:

```
DOMAIN=vibe-kanban.example.com
GITHUB_OAUTH_CLIENT_ID=<your_github_client_id>
GITHUB_OAUTH_CLIENT_SECRET=<your_github_client_secret>
VIBEKANBAN_REMOTE_JWT_SECRET=<random_base64>
VITE_RELAY_API_BASE_URL=https://relay.example.com
VK_SHARED_API_BASE=https://vibe-kanban.example.com
VK_SHARED_RELAY_API_BASE=https://relay.example.com
```

Generate JWT secret:
```bash
openssl rand -base64 32
```

> `VK_SHARED_API_BASE` and `VK_SHARED_RELAY_API_BASE` are **baked into the binary at compile time**.
> Set them before the first deploy.

### Deploy

**Save → Redeploy**.

First build takes ~15–25 min (full Rust compile). Subsequent builds use cache.

Verify all containers are running:
```bash
docker ps | grep -E "host|relay|remote|host-admin|electric"
```

---

## Step 4 — Prepare Repos Directory

The host container now auto-fixes repo/data directory ownership on startup
before dropping privileges to the `node` user. This makes first boot and GitHub
imports work without a separate init service.

For the cleanest production setup, still prepare the host repo directory before
deploying the stack:

```bash
mkdir -p /srv/vibe-kanban/repos
chown -R 1000:1000 /srv/vibe-kanban/repos
```

Default host path:

```bash
/srv/vibe-kanban/repos
```

If you want a different host path, set `HOST_REPOS_DIR=/your/path` in `.env`
before `docker compose up`.

If your deployment already provisions ownership correctly and you want stricter
runtime behavior, set:

```bash
HOST_AUTO_FIX_OWNERSHIP=0
```

Then either:

```bash
git clone https://github.com/your-org/your-repo.git /srv/vibe-kanban/repos/your-repo
```

or use **Import from GitHub** in the UI.

In Vibe Kanban UI: **New Workspace → path** = `/home/node/repos/your-repo`

---

## Step 5 — Claude Credentials (Subscription)

> Skip this step if using `ANTHROPIC_API_KEY` env var instead.

The HOST container needs Claude OAuth credentials to run tasks using your subscription.

### 5a. Get credentials from your Mac

```bash
security find-generic-password -s "Claude Code-credentials" -w
```

This outputs JSON like:
```json
{"claudeAiOauth":{"accessToken":"sk-ant-oat01-...","refreshToken":"sk-ant-ort01-...","expiresAt":...,"scopes":[...],"subscriptionType":"pro"}}
```

> If the command fails: make sure Claude Code is installed and you have logged in via `claude auth login` on your Mac at least once.

### 5b. Open host-admin

```bash
ssh -L 3005:localhost:3005 user@your-server
```

Open `http://localhost:3005` in your browser.

### 5c. Paste and save

Paste the full JSON output from step 5a into the "Claude Code" field → **Save Claude credentials**.

The credentials are saved to the `claude-credentials` Docker volume as `.credentials.json`
(the exact filename and key format that Claude Code reads on Linux: `~/.claude/.credentials.json` with key `claudeAiOauth`).

### Verify

```bash
# Get the host container name
docker ps --filter "name=host-" --format "{{.Names}}"

# Check auth status
docker exec -u node <container-name> bash -c \
  'HOME=/home/node npx @anthropic-ai/claude-code@2.1.62 auth status'
```

Expected output:
```json
{
  "loggedIn": true,
  "authMethod": "claude.ai",
  "subscriptionType": "pro"
}
```

### Token refresh

Claude OAuth tokens expire after ~8 hours. Repeat steps 5a–5c when expired.
No container restart needed.

---

## Step 6 — Login to HOST Dashboard

HOST listens on port 3004 (localhost only). Open via SSH tunnel:

```bash
ssh -L 3004:localhost:3004 user@your-server
```

Open `http://localhost:3004` → login with your vibe-kanban account.

After login, HOST automatically connects to the relay tunnel. Check logs:
```bash
docker logs <host-container-name> --tail 30
# Expected: "Relay control channel connected"
```

---

## Step 7 — Pair Browser with HOST

1. On HOST dashboard (`http://localhost:3004`):
   - **Settings → Remote Access → Enable remote access**
   - Note the **Pairing Code** (e.g. `ABCDEF`)

2. On browser at `https://vibe-kanban.example.com`:
   - **Settings → Remote Access**
   - Select host from dropdown → enter pairing code → **Pair this device**

---

## Volumes

| Volume | Contents | Mount path in HOST |
|--------|----------|-------------------|
| `host-data` | SQLite DB, config, relay credentials, process logs | `/home/node/.local/share/vibe-kanban` |
| `HOST_REPOS_DIR` bind (default `/srv/vibe-kanban/repos`) | Cloned repos | `/home/node/repos` |
| `claude-credentials` | Claude OAuth token | `/home/node/.claude` |
| `codex-credentials` | Codex auth token | `/home/node/.codex` |

---

## Running HOST on MacBook (alternative)

If you prefer to run the HOST locally instead of on the server:

### Option A: Build from source (recommended)

```bash
cd /path/to/vibe-kanban

# Step 1: Build frontend (embedded into binary at compile time)
pnpm --filter @vibe/local-web run build

# Step 2: Build and run
VK_SHARED_API_BASE=https://vibe-kanban.example.com \
VK_SHARED_RELAY_API_BASE=https://relay.example.com \
cargo run --release -p server
```

> Frontend must be built **before** the Rust binary — it is embedded at compile time.

### Option B: npx

```bash
VK_SHARED_API_BASE=https://vibe-kanban.example.com \
VK_SHARED_RELAY_API_BASE=https://relay.example.com \
npx vibe-kanban
```

> As of 2026-03-23, npx version 0.1.33 does NOT support relay pairing. Use Option A.

---

## Troubleshooting

### "Not logged in · Please run /login" in task output

Claude Code can't find valid credentials. Check in order:

1. Verify the credentials file exists:
```bash
docker exec -u root <container-name> ls -la /home/node/.claude/
# Must see: .credentials.json
```

2. Check file content has the correct key:
```bash
docker exec -u root <container-name> cat /home/node/.claude/.credentials.json
# Must have key "claudeAiOauth" (NOT "claudeAiOauthToken")
```

3. Check auth status:
```bash
docker exec -u node <container-name> bash -c \
  'HOME=/home/node npx @anthropic-ai/claude-code@2.1.62 auth status'
```

4. If `loggedIn: false` → re-paste credentials via host-admin (Step 5).

**Root cause notes:**
- File must be named `.credentials.json` (with leading dot), not `credentials.json`
- Key must be `claudeAiOauth` (what macOS Keychain outputs), NOT `claudeAiOauthToken`
- File must be readable by `node` user (mode `0o644` or owned by node)

### "Permission denied" on git operations

The host repo directory was created with the wrong owner. The host container
tries to fix this automatically at startup. If ownership is still wrong, fix it
on the host:
```bash
chown -R 1000:1000 "${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}"
```

### "repository is not owned by current user" (git safe.directory)

This should not happen in a clean deployment. It means the repo path is owned by the wrong user. Fix ownership on the host instead of whitelisting every repo in git:

```bash
chown -R 1000:1000 "${HOST_REPOS_DIR:-/srv/vibe-kanban/repos}"
```

### "--dangerously-skip-permissions cannot be used with root"

Container is running as root. The Dockerfile must have `USER node` before `ENTRYPOINT`.

### Build fails (exit code 1 or 101)

Common causes:
- Missing `cmake nasm libgit2-dev clang` in builder stage (required by `aws-lc-sys` and `git2`)
- Missing `SQLX_OFFLINE=true` in builder stage
- `VK_SHARED_API_BASE` not set as build arg before first deploy

### Relay not reachable

```bash
curl https://relay.example.com/health
# Expected: {"status":"ok"}
```

If 404/502:
- Cloudflare SSL/TLS must be `Full` (not Flexible)
- Cloudflare WebSockets must be **On**
- Check: `docker logs <relay-container-name>`

### 405 on relay pairing

MacBook binary is too old (< 0.1.34). Build from source (Option A above).

### "EACCES: permission denied" when saving Codex credentials in host-admin

The `codex-credentials` volume is freshly mounted — its root directory has restrictive default permissions. Fix once on the server:

```bash
docker exec -u root $(docker ps --filter "name=host-admin" --format "{{.Names}}") chmod -R 777 /creds
```

Then paste credentials again. This only affects first-time use of the Codex volume.

### Codex credentials — getting auth.json from Mac

```bash
cat ~/.codex/auth.json
```

Paste output into the "Codex" field in host-admin (`http://localhost:3005`).
