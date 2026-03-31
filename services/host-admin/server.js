/**
 * Public Host Admin console for vibe-kanban.
 *
 * - Serves the built React UI
 * - Protects all admin APIs behind a single shared secret
 * - Stores session state in an HTTP-only cookie
 * - Writes Claude/Codex credentials into mounted volumes
 * - Proxies safe workspace/branch/cleanup operations to the host service
 *
 * No npm dependencies - uses Node.js built-ins only.
 */
"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const http = require("http");

const PORT = parseInt(process.env.PORT || "3005", 10);
const CLAUDE_DIR = process.env.CLAUDE_CREDS_DIR || "/creds/claude";
const CODEX_DIR = process.env.CODEX_CREDS_DIR || "/creds/codex";
const HOST_DATA_DIR = process.env.HOST_DATA_DIR || "/data/host-data";
const HOST_ADMIN_BASE_URL = (
  process.env.HOST_ADMIN_BASE_URL || "http://host:3004"
).replace(/\/+$/, "");
const HOST_ADMIN_SECRET = process.env.HOST_ADMIN_SECRET || "";
const COOKIE_SECURE =
  process.env.NODE_ENV === "production" &&
  process.env.HOST_ADMIN_COOKIE_SECURE !== "false";
const DIST_DIR = path.join(__dirname, "dist");
const SESSION_COOKIE_NAME = "host_admin_session";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const sessions = new Map();

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

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true, mode: 0o755 });
  }
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(res, status, body, extraHeaders = {}) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...extraHeaders,
  });
  res.end(payload);
}

function parseJsonBody(body) {
  try {
    return {
      ok: true,
      data: JSON.parse(body),
    };
  } catch {
    return {
      ok: false,
      error: "Invalid JSON body",
    };
  }
}

function statusFor(dir, filename) {
  const fullPath = path.join(dir, filename);
  if (!fs.existsSync(fullPath)) {
    return "not set";
  }

  try {
    const stat = fs.statSync(fullPath);
    return `saved (${(stat.size / 1024).toFixed(1)} KB, ${stat.mtime.toLocaleDateString()})`;
  } catch {
    return "error";
  }
}

function contentTypeFor(filePath) {
  return (
    CONTENT_TYPES[path.extname(filePath).toLowerCase()] ||
    "application/octet-stream"
  );
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
    "Cache-Control":
      path.extname(filePath) === ".html"
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    "Content-Type": contentTypeFor(filePath),
  });

  if (method === "HEAD") {
    res.end();
    return;
  }

  fs.createReadStream(filePath)
    .on("error", (error) => {
      console.error("[host-admin]", error);
      if (!res.headersSent) {
        json(res, 500, { error: String(error) });
      } else {
        res.destroy(error);
      }
    })
    .pipe(res);
}

function parseCookies(req) {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) {
    return {};
  }

  return rawCookie.split(";").reduce((cookies, chunk) => {
    const [rawKey, ...rawValueParts] = chunk.split("=");
    if (!rawKey) {
      return cookies;
    }

    const key = rawKey.trim();
    const value = rawValueParts.join("=").trim();
    cookies[key] = decodeURIComponent(value);
    return cookies;
  }, {});
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

function createSession() {
  cleanupExpiredSessions();
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

function getSessionToken(req) {
  const cookies = parseCookies(req);
  return cookies[SESSION_COOKIE_NAME] || null;
}

function isAuthenticated(req) {
  cleanupExpiredSessions();

  const token = getSessionToken(req);
  if (!token) {
    return false;
  }

  const session = sessions.get(token);
  if (!session) {
    return false;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return false;
  }

  return true;
}

function buildSessionCookie(token, maxAgeSeconds) {
  const parts = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "HttpOnly",
    "Path=/",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (COOKIE_SECURE) {
    parts.push("Secure");
  }

  return parts.join("; ");
}

function clearSession(req) {
  const token = getSessionToken(req);
  if (token) {
    sessions.delete(token);
  }
}

function compareSecret(candidate) {
  if (!HOST_ADMIN_SECRET) {
    return false;
  }

  if (typeof candidate !== "string") {
    return false;
  }

  const expected = Buffer.from(HOST_ADMIN_SECRET);
  const provided = Buffer.from(candidate);
  if (expected.length !== provided.length) {
    return false;
  }

  return crypto.timingSafeEqual(expected, provided);
}

function requireConfiguredSecret(res) {
  if (HOST_ADMIN_SECRET) {
    return true;
  }

  json(res, 503, { error: "HOST_ADMIN_SECRET is not configured." });
  return false;
}

function requireAuth(req, res) {
  if (!requireConfiguredSecret(res)) {
    return false;
  }

  if (!isAuthenticated(req)) {
    json(res, 401, { error: "Unauthorized" });
    return false;
  }

  return true;
}

function deleteDirectoryContents(dir) {
  if (!fs.existsSync(dir)) {
    return;
  }

  for (const entry of fs.readdirSync(dir)) {
    fs.rmSync(path.join(dir, entry), {
      recursive: true,
      force: true,
      maxRetries: 3,
    });
  }
}

function clearCredentials(tool) {
  if (!tool || tool === "all") {
    deleteDirectoryContents(CLAUDE_DIR);
    deleteDirectoryContents(CODEX_DIR);
    return;
  }

  if (tool === "claude") {
    deleteDirectoryContents(CLAUDE_DIR);
    return;
  }

  if (tool === "codex") {
    deleteDirectoryContents(CODEX_DIR);
    return;
  }

  throw new Error("Unknown credentials target");
}

async function proxyToHost(method, targetPath, body) {
  const requestInit = {
    method,
    headers: {
      Accept: "application/json",
    },
  };

  if (body != null) {
    requestInit.headers["Content-Type"] = "application/json";
    requestInit.body = body;
  }

  const response = await fetch(`${HOST_ADMIN_BASE_URL}${targetPath}`, requestInit);
  const responseBody = await response.text();

  return {
    status: response.status,
    body: responseBody,
    contentType:
      response.headers.get("content-type") || "application/json; charset=utf-8",
  };
}

function sendProxyResponse(res, proxied) {
  res.writeHead(proxied.status, {
    "Content-Type": proxied.contentType,
  });
  res.end(proxied.body);
}

async function handleLogin(req, res) {
  if (!requireConfiguredSecret(res)) {
    return;
  }

  const parsed = parseJsonBody(await readBody(req));
  if (!parsed.ok) {
    json(res, 400, { error: parsed.error });
    return;
  }

  if (!compareSecret(parsed.data.secret)) {
    json(res, 401, { error: "Invalid admin secret." });
    return;
  }

  const token = createSession();
  json(
    res,
    200,
    { message: "Logged in." },
    {
      "Set-Cookie": buildSessionCookie(token, Math.floor(SESSION_TTL_MS / 1000)),
    },
  );
}

async function handleLogout(req, res) {
  clearSession(req);
  json(
    res,
    200,
    { message: "Logged out." },
    {
      "Set-Cookie": buildSessionCookie("", 0),
    },
  );
}

async function handleSaveCredentials(req, res) {
  const parsed = parseJsonBody(await readBody(req));
  if (!parsed.ok) {
    json(res, 400, { error: parsed.error });
    return;
  }

  const { tool, credentials } = parsed.data;
  if (!["claude", "codex"].includes(tool)) {
    json(res, 400, { error: "Unknown tool." });
    return;
  }

  let credentialObject;
  try {
    credentialObject = JSON.parse(credentials);
  } catch {
    json(res, 400, { error: "credentials must be valid JSON." });
    return;
  }

  const dir = tool === "claude" ? CLAUDE_DIR : CODEX_DIR;
  const filename = tool === "claude" ? ".credentials.json" : "auth.json";
  ensureDir(dir);

  fs.writeFileSync(path.join(dir, filename), JSON.stringify(credentialObject, null, 2), {
    mode: 0o644,
  });

  console.log(`[host-admin] saved ${tool} credentials to ${dir}/${filename}`);
  json(res, 200, { message: `${tool} credentials saved successfully.` });
}

async function handleClearCredentials(req, res) {
  const parsed = parseJsonBody(await readBody(req));
  if (!parsed.ok) {
    json(res, 400, { error: parsed.error });
    return;
  }

  try {
    clearCredentials(parsed.data.tool || "all");
  } catch (error) {
    json(res, 400, {
      error:
        error instanceof Error ? error.message : "Failed to clear credentials.",
    });
    return;
  }

  json(res, 200, { message: "Credentials cleared." });
}

function handleStatus(res) {
  json(res, 200, {
    claude: statusFor(CLAUDE_DIR, ".credentials.json"),
    codex: statusFor(CODEX_DIR, "auth.json"),
  });
}

function handleSession(req, res) {
  json(res, 200, {
    authenticated: isAuthenticated(req),
    configured: Boolean(HOST_ADMIN_SECRET),
  });
}

function handleCleanData(res) {
  clearCredentials("all");
  deleteDirectoryContents(HOST_DATA_DIR);

  json(res, 200, {
    message:
      "Persisted host data and saved credentials were removed. Restart or redeploy the host service before using it again.",
  });
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/auth/session") {
    handleSession(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/login") {
    await handleLogin(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/auth/logout") {
    await handleLogout(req, res);
    return;
  }

  if (!requireAuth(req, res)) {
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/credentials/status") {
    handleStatus(res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/credentials/save") {
    await handleSaveCredentials(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/credentials/clear") {
    await handleClearCredentials(req, res);
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/cleanup/data") {
    handleCleanData(res);
    return;
  }

  if (
    req.method === "POST" &&
    url.pathname === "/api/cleanup/orphan-worktrees"
  ) {
    try {
      sendProxyResponse(
        res,
        await proxyToHost("POST", "/api/admin/cleanup/orphan-worktrees"),
      );
    } catch (error) {
      json(res, 502, {
        error:
          error instanceof Error ? error.message : "Host service unavailable.",
      });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/workspaces") {
    try {
      sendProxyResponse(res, await proxyToHost("GET", "/api/workspaces"));
    } catch (error) {
      json(res, 502, {
        error:
          error instanceof Error ? error.message : "Host service unavailable.",
      });
    }
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/workspaces/")) {
    const workspaceId = url.pathname.slice("/api/workspaces/".length);
    if (!workspaceId) {
      json(res, 400, { error: "Workspace id is required." });
      return;
    }

    const deleteBranches = url.searchParams.get("delete_branches") === "true";
    const search = new URLSearchParams();
    if (deleteBranches) {
      search.set("delete_branches", "true");
    }

    try {
      sendProxyResponse(
        res,
        await proxyToHost(
          "DELETE",
          `/api/workspaces/${encodeURIComponent(workspaceId)}${
            search.size > 0 ? `?${search.toString()}` : ""
          }`,
        ),
      );
    } catch (error) {
      json(res, 502, {
        error:
          error instanceof Error ? error.message : "Host service unavailable.",
      });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/repos") {
    try {
      sendProxyResponse(res, await proxyToHost("GET", "/api/repos"));
    } catch (error) {
      json(res, 502, {
        error:
          error instanceof Error ? error.message : "Host service unavailable.",
      });
    }
    return;
  }

  if (
    req.method === "GET" &&
    /^\/api\/repos\/[^/]+\/branches$/.test(url.pathname)
  ) {
    const repoId = url.pathname.split("/")[3];
    try {
      sendProxyResponse(
        res,
        await proxyToHost("GET", `/api/repos/${encodeURIComponent(repoId)}/branches`),
      );
    } catch (error) {
      json(res, 502, {
        error:
          error instanceof Error ? error.message : "Host service unavailable.",
      });
    }
    return;
  }

  if (
    req.method === "DELETE" &&
    /^\/api\/repos\/[^/]+\/branches\/.+/.test(url.pathname)
  ) {
    const pathParts = url.pathname.split("/");
    const repoId = pathParts[3];
    const branchName = decodeURIComponent(pathParts.slice(5).join("/"));

    if (!branchName) {
      json(res, 400, { error: "Branch name is required." });
      return;
    }

    try {
      sendProxyResponse(
        res,
        await proxyToHost(
          "DELETE",
          `/api/repos/${encodeURIComponent(repoId)}/branches/${encodeURIComponent(branchName)}`,
        ),
      );
    } catch (error) {
      json(res, 502, {
        error:
          error instanceof Error ? error.message : "Host service unavailable.",
      });
    }
    return;
  }

  json(res, 404, { error: "Not found" });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    if (["GET", "HEAD"].includes(req.method || "")) {
      const staticFile = distFileFor(req.url);
      if (staticFile) {
        serveStatic(res, staticFile, req.method);
        return;
      }
    }

    res.writeHead(404);
    res.end("Not found");
  } catch (error) {
    console.error("[host-admin]", error);
    json(res, 500, {
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`[host-admin] listening on http://0.0.0.0:${PORT}`);
  console.log(`  Claude creds dir   : ${CLAUDE_DIR}`);
  console.log(`  Codex creds dir    : ${CODEX_DIR}`);
  console.log(`  Host data dir      : ${HOST_DATA_DIR}`);
  console.log(`  Host admin base URL: ${HOST_ADMIN_BASE_URL}`);
  console.log(
    `  Host admin secret  : ${HOST_ADMIN_SECRET ? "configured" : "missing"}`,
  );
});
