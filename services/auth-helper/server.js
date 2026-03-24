/**
 * Minimal credential-injector for vibe-kanban HOST containers.
 * Serves a web UI where you can paste ~/.claude/credentials.json
 * (or ~/.codex/auth.json) from your local machine to save them
 * into the Docker volumes mounted by the HOST container.
 *
 * No npm dependencies — uses Node.js built-ins only.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.env.PORT || '3005', 10);
const CLAUDE_DIR = process.env.CLAUDE_CREDS_DIR || '/creds/claude';
const CODEX_DIR  = process.env.CODEX_CREDS_DIR  || '/creds/codex';

// ── helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o700 });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', c => chunks.push(c));
    req.on('end',  () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(payload);
}

function statusFor(dir, filename) {
  const full = path.join(dir, filename);
  if (!fs.existsSync(full)) return 'not set';
  try {
    const stat = fs.statSync(full);
    return `saved (${(stat.size / 1024).toFixed(1)} KB, ${stat.mtime.toLocaleDateString()})`;
  } catch { return 'error'; }
}

// ── HTML page ─────────────────────────────────────────────────────────────────

const HTML = String.raw`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>vibe-kanban · AI credentials</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0f1117; color: #e2e8f0;
      min-height: 100vh; display: flex; flex-direction: column;
      align-items: center; justify-content: flex-start;
      padding: 2rem 1rem;
    }
    h1 { font-size: 1.4rem; font-weight: 600; margin-bottom: 0.3rem; }
    .sub { color: #94a3b8; font-size: 0.85rem; margin-bottom: 2rem; }
    .card {
      background: #1e2432; border: 1px solid #2d3748;
      border-radius: 12px; padding: 1.5rem; width: 100%; max-width: 640px;
      margin-bottom: 1.25rem;
    }
    .card h2 { font-size: 1rem; font-weight: 600; margin-bottom: 0.4rem; display: flex; align-items: center; gap: 0.5rem; }
    .badge {
      font-size: 0.72rem; padding: 2px 8px; border-radius: 99px;
      background: #1a2744; color: #60a5fa; border: 1px solid #2563eb;
    }
    .badge.ok { background: #052e16; color: #4ade80; border-color: #16a34a; }
    .hint { color: #64748b; font-size: 0.8rem; margin-bottom: 0.75rem; line-height: 1.5; }
    .hint code {
      background: #0f1117; border: 1px solid #2d3748;
      padding: 1px 6px; border-radius: 4px; font-size: 0.78rem; color: #a78bfa;
    }
    textarea {
      width: 100%; height: 140px; background: #0f1117;
      border: 1px solid #2d3748; border-radius: 8px;
      color: #e2e8f0; font-family: 'JetBrains Mono', monospace; font-size: 0.78rem;
      padding: 0.6rem; resize: vertical; outline: none;
    }
    textarea:focus { border-color: #4f46e5; }
    button {
      margin-top: 0.75rem; padding: 0.5rem 1.25rem;
      background: #4f46e5; color: #fff; border: none; border-radius: 8px;
      font-size: 0.875rem; font-weight: 500; cursor: pointer;
    }
    button:hover { background: #4338ca; }
    .msg { margin-top: 0.6rem; font-size: 0.8rem; min-height: 1.2em; }
    .msg.ok  { color: #4ade80; }
    .msg.err { color: #f87171; }
    .status-row { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; }
    .divider { border: none; border-top: 1px solid #2d3748; margin: 1.5rem 0; }
    footer { color: #475569; font-size: 0.75rem; margin-top: 1rem; }
  </style>
</head>
<body>
  <h1>vibe-kanban · AI credentials</h1>
  <p class="sub">Paste your local credentials files to authenticate the HOST container.</p>

  <!-- Claude -->
  <div class="card">
    <h2>
      Claude Code (Anthropic)
      <span class="badge" id="claude-badge">loading…</span>
    </h2>
    <div class="hint">
      On your <strong>local Mac</strong>, run:<br>
      <code>security find-generic-password -s "Claude Code-credentials" -w</code><br>
      then paste the output below.
    </div>
    <div class="status-row">
      <small id="claude-status" style="color:#64748b">checking…</small>
    </div>
    <textarea id="claude-ta" placeholder='{"claudeAiOauth":{"accessToken":"sk-ant-oat01-...","refreshToken":"sk-ant-ort01-...","expiresAt":...}}'></textarea>
    <br>
    <button onclick="save('claude')">Save Claude credentials</button>
    <div class="msg" id="claude-msg"></div>
  </div>

  <!-- Codex -->
  <div class="card">
    <h2>
      Codex (OpenAI)
      <span class="badge" id="codex-badge">loading…</span>
    </h2>
    <div class="hint">
      On your <strong>local machine</strong>, run:<br>
      <code>cat ~/.codex/auth.json</code><br>
      then paste the output below.  Alternatively set
      <code>OPENAI_API_KEY</code> in <code>.env</code>.
    </div>
    <div class="status-row">
      <small id="codex-status" style="color:#64748b">checking…</small>
    </div>
    <textarea id="codex-ta" placeholder='{"token":"sk-...","...":""}'></textarea>
    <br>
    <button onclick="save('codex')">Save Codex credentials</button>
    <div class="msg" id="codex-msg"></div>
  </div>

  <footer>Accessible only on 127.0.0.1 — do not expose this port publicly.</footer>

  <script>
    async function loadStatus() {
      const res = await fetch('/status').then(r => r.json()).catch(() => ({}));
      for (const tool of ['claude', 'codex']) {
        const s = res[tool] || 'unknown';
        const isOk = s.startsWith('saved');
        document.getElementById(tool + '-status').textContent = s;
        const badge = document.getElementById(tool + '-badge');
        badge.textContent = isOk ? 'saved ✓' : 'not set';
        badge.className = 'badge' + (isOk ? ' ok' : '');
      }
    }

    async function save(tool) {
      const ta  = document.getElementById(tool + '-ta');
      const msg = document.getElementById(tool + '-msg');
      const raw = ta.value.trim();
      if (!raw) { msg.className = 'msg err'; msg.textContent = 'Nothing to save.'; return; }

      // Validate JSON
      try { JSON.parse(raw); } catch(e) {
        msg.className = 'msg err';
        msg.textContent = 'Invalid JSON: ' + e.message;
        return;
      }

      msg.className = 'msg'; msg.textContent = 'Saving…';
      try {
        const res = await fetch('/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool, credentials: raw }),
        });
        const data = await res.json();
        if (res.ok) {
          msg.className = 'msg ok';
          msg.textContent = '✓ ' + data.message;
          ta.value = '';
          loadStatus();
        } else {
          msg.className = 'msg err';
          msg.textContent = data.error || 'Server error';
        }
      } catch(e) {
        msg.className = 'msg err';
        msg.textContent = 'Network error: ' + e.message;
      }
    }

    loadStatus();
  </script>
</body>
</html>`;

// ── request handler ───────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    // GET /
    if (req.method === 'GET' && req.url === '/') {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(HTML);
    }

    // GET /status
    if (req.method === 'GET' && req.url === '/status') {
      return json(res, 200, {
        claude: statusFor(CLAUDE_DIR, '.credentials.json'),
        codex:  statusFor(CODEX_DIR,  'auth.json'),
      });
    }

    // POST /save
    if (req.method === 'POST' && req.url === '/save') {
      const body = await readBody(req);
      let parsed;
      try { parsed = JSON.parse(body); } catch {
        return json(res, 400, { error: 'Invalid JSON body' });
      }

      const { tool, credentials } = parsed;
      if (!['claude', 'codex'].includes(tool)) {
        return json(res, 400, { error: 'Unknown tool' });
      }

      // Validate that credentials is valid JSON
      let credObj;
      try { credObj = JSON.parse(credentials); } catch {
        return json(res, 400, { error: 'credentials must be valid JSON' });
      }

      const dir      = tool === 'claude' ? CLAUDE_DIR : CODEX_DIR;
      const filename = tool === 'claude' ? '.credentials.json' : 'auth.json';
      ensureDir(dir);
      // mode 0o644 — auth-helper runs as root; HOST container's node user needs read access
      fs.writeFileSync(path.join(dir, filename), JSON.stringify(credObj, null, 2), { mode: 0o644 });

      console.log(`[auth-helper] saved ${tool} credentials to ${dir}/${filename}`);
      return json(res, 200, { message: `${tool} credentials saved successfully.` });
    }

    res.writeHead(404);
    res.end('Not found');
  } catch (err) {
    console.error('[auth-helper]', err);
    json(res, 500, { error: String(err) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[auth-helper] listening on http://0.0.0.0:${PORT}`);
  console.log(`  Claude creds dir : ${CLAUDE_DIR}`);
  console.log(`  Codex  creds dir : ${CODEX_DIR}`);
});
