# Host Admin Web

This package contains the standalone Host Admin web UI.

## Development

The Host Admin UI has two backend layers in development:

- The main local host server
- The Host Admin service in `services/host-admin/server.js`

In development, the Vite app proxies `/api/*` to the Host Admin service on
`http://localhost:${HOST_ADMIN_PORT || 3005}`.

The Host Admin service then proxies workspace, branch, cleanup, and repo
terminal operations to the main local host server.

### Start the backend

From the repository root:

```bash
pnpm run backend:dev
```

### Start the Host Admin service

In a second terminal, from the repository root:

```bash
pnpm run host-admin:service:dev
```

This script:

- reuses the repo's allocated backend port
- points `HOST_ADMIN_BASE_URL` at that backend
- starts the Host Admin service on port `3005`
- uses `HOST_ADMIN_SECRET=dev-secret` if you did not set one

If you want a different secret, export `HOST_ADMIN_SECRET` before starting the
service.

### Start the Host Admin UI

In a third terminal:

```bash
pnpm --filter @vibe/host-admin-web dev
```

If you want the Host Admin service on a different port, export
`HOST_ADMIN_PORT` before starting both the service and the Vite app.

## Common dev errors

### `Unexpected token '<', "<!doctype "... is not valid JSON`

The frontend tried to parse a response as JSON, but received HTML instead.

In development, that usually means the `/api/*` request did not reach the
Host Admin service and hit the Vite app shell or another HTML response.

Check:

1. The Host Admin UI is running with the `/api` proxy enabled.
2. The Host Admin service is running on the expected port.
3. You restarted the Vite dev server after changing proxy configuration.

### `http proxy error` / `ECONNREFUSED`

The Vite proxy is working, but nothing is listening on the target Host Admin
service port.

Check:

1. `pnpm run host-admin:service:dev` is still running.
2. `HOST_ADMIN_PORT` matches the Host Admin service port.
3. `pnpm run backend:dev` is still running, because the Host Admin service
   also depends on the main backend.

### `Browserslist: browsers data (caniuse-lite) is ... old`

This is a warning about outdated browser compatibility data. It does not block
the Host Admin UI from running.
