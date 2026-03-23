# Self-hosted Vibe Kanban Setup Guide

## Architecture

```
Browser (vibe-kanban.solostylist.com)
    → remote-server (Coolify)
    → relay-server (Coolify, relay.solostylist.com)
    → HOST machine (MacBook running local server)
    → Executes tasks (Claude, git, etc.)
```

The web dashboard **cannot run tasks by itself** — it requires a HOST machine connected via relay.

---

## Coolify Configuration

### 1. Domains

In **Configuration → General → Domains**:

```
remote-server: https://vibe-kanban.solostylist.com
relay-server:  https://relay.solostylist.com
electric:      (leave blank or internal)
```

> Both must use `https://`, not `http://`.

### 2. Environment Variables

In **Configuration → Environment Variables**:

```
GITHUB_OAUTH_CLIENT_ID=<your_client_id>
GITHUB_OAUTH_CLIENT_SECRET=<your_client_secret>
VIBEKANBAN_REMOTE_JWT_SECRET=<random_base64_string>
DOMAIN=vibe-kanban.solostylist.com
VITE_RELAY_API_BASE_URL=https://relay.solostylist.com
```

Generate JWT secret:
```bash
openssl rand -base64 32
```

After any env/domain change: **Save → Redeploy**.

---

## GitHub OAuth App

Go to GitHub → Settings → Developer Settings → OAuth Apps → create/edit app:

```
Homepage URL:              https://vibe-kanban.solostylist.com
Authorization callback URL: https://vibe-kanban.solostylist.com/v1/oauth/github/callback
```

---

## Cloudflare Configuration

Both `vibe-kanban.solostylist.com` and `relay.solostylist.com` go through Cloudflare.

1. **SSL/TLS mode**: Set to `Full` (not Flexible) — avoids 302 redirect loops
2. **WebSockets**: Network → WebSockets → **On** — required for relay tunnel

---

## Running HOST on MacBook

### Option A: npx (version 0.1.33, no relay pairing support)

```bash
VK_SHARED_API_BASE=https://vibe-kanban.solostylist.com \
VK_SHARED_RELAY_API_BASE=https://relay.solostylist.com \
npx vibe-kanban
```

> As of 2026-03-23, latest npm version is 0.1.33 which does NOT support relay pairing (405 error on spake2/start). Use Option B instead.

### Option B: Build from source (recommended)

```bash
cd /Users/leo/Desktop/vibe-kanban

# Step 1: Build frontend first (embedded into binary at compile time)
pnpm --filter @vibe/local-web run build

# Step 2: Build Rust binary
cargo build --release -p server

# Step 3: Run
VK_SHARED_API_BASE=https://vibe-kanban.solostylist.com \
VK_SHARED_RELAY_API_BASE=https://relay.solostylist.com \
./target/release/server
```

> IMPORTANT: Frontend must be built BEFORE the Rust binary — it is embedded at compile time using rust-embed.

---

## Pairing a Browser Client to the HOST

1. On MacBook: open the local dashboard → Settings → Remote Access
   - Enable **Enable remote access**
   - Note the **Pairing Code** (e.g. `SWPVLC`)

2. In browser at `https://vibe-kanban.solostylist.com`:
   - Settings → Remote Access
   - Select host from dropdown
   - Enter the 6-character pairing code
   - Click **Pair this device**

---

## Debugging

### Relay not reachable
```bash
curl https://relay.solostylist.com/health
# Expected: {"status":"ok"}
```

### Check relay is routing (not Traefik 404)
```bash
curl -v https://relay.solostylist.com/health 2>&1 | grep "HTTP/"
# Expected: HTTP/2 200
```

### Relay loop in MacBook logs
If you see `Connecting relay... → Relay reconnect loop exited → Relay auto-reconnect loop started` repeating:
- Cloudflare WebSocket not enabled, OR
- SSL mode is Flexible (causing redirect loop)

### 405 on pairing
MacBook binary is too old (< 0.1.34). Build from source (Option B above).
