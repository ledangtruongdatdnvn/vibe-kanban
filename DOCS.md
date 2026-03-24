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

---

## Running HOST on the Coolify Server (Docker)

Thay vì dùng MacBook làm HOST, có thể biến chính server đang chạy Coolify thành HOST.
Relay tunnel chạy nội bộ trong Docker network → không cần expose port ra ngoài.

### Architecture mới

```
Browser (vibe-kanban.solostylist.com)
    → remote-server (Coolify)
    → relay-server  (Coolify, ws://relay-server:8082  ← nội bộ Docker)
    → HOST container (cùng Docker stack)
    → Executes tasks (Claude, git, etc.)
```

---

### Bước 1 — Thêm HOST + auth-helper vào docker-compose.yaml

File `docker-compose.yaml` đã có sẵn 2 service mới: `host` và `auth-helper`.
Chỉ cần redeploy stack trong Coolify là chúng được build và khởi động.

---

### Bước 2 — Thêm biến môi trường trong Coolify

Trong **Configuration → Environment Variables** của stack, thêm:

```
# Build-time: bake URLs vào binary
VK_SHARED_API_BASE=https://vibe-kanban.solostylist.com
VK_SHARED_RELAY_API_BASE=https://relay.solostylist.com

# Runtime: HOST kết nối relay qua Docker network nội bộ (nhanh hơn, không qua Cloudflare)
# Dòng này override VK_SHARED_RELAY_API_BASE lúc runtime
# (đã có sẵn trong docker-compose, không cần thêm nếu không muốn thay đổi)
```

> **Lưu ý build args:** Coolify truyền env vars của stack vào `build.args` tự động.
> Đảm bảo `VK_SHARED_API_BASE` và `VK_SHARED_RELAY_API_BASE` được set **trước khi** bấm Deploy lần đầu — chúng được bake vào binary lúc compile.

---

### Bước 3 — Deploy

Trong Coolify: **Save → Redeploy**.

Lần đầu build rất lâu (~15–25 phút) vì phải compile toàn bộ Rust workspace.
Các lần sau dùng Docker build cache, nhanh hơn nhiều.

Kiểm tra HOST đang chạy:
```bash
# SSH vào server
docker ps | grep host
# Expected: vibe-kanban-host-1   Up X minutes
```

---

### Bước 4 — Cài credentials Claude (dùng subscription)

> Bỏ qua bước này nếu dùng API key (`ANTHROPIC_API_KEY` đã set trong Coolify env).

**4a. Mở SSH tunnel từ máy local:**

```bash
ssh -L 3005:localhost:3005 user@your-server
```

Giữ terminal này mở.

**4b. Mở `http://localhost:3005` trên browser của bạn.**

Bạn sẽ thấy giao diện "AI credentials".

**4c. Lấy credentials từ máy local (phải đã login Claude trước):**

```bash
# Trên máy local (MacBook)
cat ~/.claude/credentials.json
```

Nếu chưa login:
```bash
npx -y @anthropic-ai/claude-code login
# rồi chạy lại lệnh cat ở trên
```

**4d. Paste nội dung vào ô "Claude Code" → bấm Save.**

Credentials được lưu vào Docker volume `claude-credentials`, HOST container tự đọc được ngay.

---

### Bước 5 — Mở HOST dashboard và login

HOST đang lắng nghe ở port 3004 (bind `127.0.0.1` — không expose ra ngoài).
Mở qua SSH tunnel:

```bash
# Thêm vào tunnel trước đó hoặc mở tunnel mới
ssh -L 3004:localhost:3004 user@your-server
```

Mở `http://localhost:3004` → đăng nhập bằng tài khoản vibe-kanban.

Sau khi login, HOST tự động kết nối relay tunnel. Kiểm tra log:
```bash
docker logs vibe-kanban-host-1 --tail 30
# Expected: "Relay auto-reconnect loop started"
# rồi: "Relay control channel connected"
```

---

### Bước 6 — Pair browser với HOST

1. Trên HOST dashboard (`http://localhost:3000`):
   - **Settings → Remote Access → Enable remote access**
   - Ghi lại **Pairing Code** (6 ký tự, VD: `ABCDEF`)

2. Trên browser tại `https://vibe-kanban.solostylist.com`:
   - **Settings → Remote Access**
   - Chọn host từ dropdown → nhập pairing code → **Pair this device**

---

### Volumes và dữ liệu

| Volume | Nội dung | Path trong container |
|--------|----------|---------------------|
| `host-data` | SQLite DB, config, SSH keys | `/root/.vibe-kanban` |
| `host-repos` | Repos được clone | `/root/repos` |
| `claude-credentials` | OAuth token Claude | `/root/.claude` |
| `codex-credentials` | Auth token Codex | `/root/.codex` |

---

### Tái xác thực Claude (khi token hết hạn)

Token Claude thường có hạn vài tháng. Khi hết hạn, lặp lại **Bước 4**:
- SSH tunnel → `http://localhost:3005` → paste credentials mới → Save
- Không cần restart container.

---

### Lưu ý với Coolify

- **Đừng gán domain** cho service `host` hay `auth-helper` trong Coolify — chúng không cần expose qua Traefik.
- `auth-helper` chỉ bind `127.0.0.1:3005` — truy cập qua SSH tunnel, không bao giờ để public.
- Nếu Coolify tự động thêm `VIRTUAL_HOST` hay `traefik` labels cho `host` service, hãy xóa đi.
- Docker socket (`/var/run/docker.sock`) trong `host` service cho phép HOST spawn Docker-based executors — Coolify hoàn toàn cho phép điều này.

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
