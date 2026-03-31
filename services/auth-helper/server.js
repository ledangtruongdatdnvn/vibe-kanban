/**
 * Minimal credential-injector for vibe-kanban HOST containers.
 * Serves a built React UI where you can paste ~/.claude/credentials.json
 * (or ~/.codex/auth.json) from your local machine to save them into
 * the Docker volumes mounted by the HOST container.
 *
 * No npm dependencies — uses Node.js built-ins only.
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = parseInt(process.env.PORT || "3005", 10);
const CLAUDE_DIR = process.env.CLAUDE_CREDS_DIR || "/creds/claude";
const CODEX_DIR = process.env.CODEX_CREDS_DIR || "/creds/codex";
const DIST_DIR = path.join(__dirname, "dist");

const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(payload);
}

function statusFor(dir, filename) {
  const full = path.join(dir, filename);
  if (!fs.existsSync(full)) return "not set";
  try {
    const stat = fs.statSync(full);
    return `saved (${(stat.size / 1024).toFixed(1)} KB, ${stat.mtime.toLocaleDateString()})`;
  } catch {
    return "error";
  }
}

function contentTypeFor(filePath) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
}

function distFileFor(urlPath) {
  const pathname = decodeURIComponent((urlPath || "/").split("?")[0]);
  const requestedPath = pathname === "/" ? "/index.html" : pathname;
  const fullPath = path.resolve(DIST_DIR, `.${requestedPath}`);

  if (fullPath !== DIST_DIR && !fullPath.startsWith(`${DIST_DIR}${path.sep}`)) {
    return null;
  }

  if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
    return fullPath;
  }

  if (!path.extname(requestedPath)) {
    const indexPath = path.join(DIST_DIR, "index.html");
    if (fs.existsSync(indexPath) && fs.statSync(indexPath).isFile()) {
      return indexPath;
    }
  }

  return null;
}

function serveStatic(res, filePath, method = "GET") {
  res.writeHead(200, {
    "Cache-Control": path.extname(filePath) === ".html" ? "no-cache" : "public, max-age=31536000, immutable",
    "Content-Type": contentTypeFor(filePath),
  });

  if (method === "HEAD") {
    return res.end();
  }

  fs.createReadStream(filePath)
    .on("error", (err) => {
      console.error("[auth-helper]", err);
      if (!res.headersSent) {
        json(res, 500, { error: String(err) });
      } else {
        res.destroy(err);
      }
    })
    .pipe(res);
}

// ── request handler ───────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  try {
    // GET /status
    if (req.method === "GET" && req.url === "/status") {
      return json(res, 200, {
        claude: statusFor(CLAUDE_DIR, ".credentials.json"),
        codex: statusFor(CODEX_DIR, "auth.json"),
      });
    }

    // POST /save
    if (req.method === "POST" && req.url === "/save") {
      const body = await readBody(req);
      let parsed;
      try {
        parsed = JSON.parse(body);
      } catch {
        return json(res, 400, { error: "Invalid JSON body" });
      }

      const { tool, credentials } = parsed;
      if (!["claude", "codex"].includes(tool)) {
        return json(res, 400, { error: "Unknown tool" });
      }

      // Validate that credentials is valid JSON
      let credObj;
      try {
        credObj = JSON.parse(credentials);
      } catch {
        return json(res, 400, { error: "credentials must be valid JSON" });
      }

      const dir = tool === "claude" ? CLAUDE_DIR : CODEX_DIR;
      const filename = tool === "claude" ? ".credentials.json" : "auth.json";
      ensureDir(dir);
      // mode 0o644 — auth-helper runs as root; HOST container's node user needs read access
      fs.writeFileSync(
        path.join(dir, filename),
        JSON.stringify(credObj, null, 2),
        { mode: 0o644 },
      );

      console.log(
        `[auth-helper] saved ${tool} credentials to ${dir}/${filename}`,
      );
      return json(res, 200, {
        message: `${tool} credentials saved successfully.`,
      });
    }

    if (["GET", "HEAD"].includes(req.method || "")) {
      const staticFile = distFileFor(req.url);
      if (staticFile) {
        return serveStatic(res, staticFile, req.method);
      }
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (err) {
    console.error("[auth-helper]", err);
    json(res, 500, { error: String(err) });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[auth-helper] listening on http://0.0.0.0:${PORT}`);
  console.log(`  Claude creds dir : ${CLAUDE_DIR}`);
  console.log(`  Codex  creds dir : ${CODEX_DIR}`);
});
