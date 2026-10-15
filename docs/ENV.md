# Environment Variables

<!-- AUTO-GENERATED:ENV:START -->
## Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret for JWT token signing (min 32 chars) | `your-secret-at-least-32-characters-long` |
| `CLIPROXYAPI_MANAGEMENT_URL` | CLIProxyAPI management API base URL | `http://localhost:28317/v0/management` |
| `MANAGEMENT_API_KEY` | API key for CLIProxyAPI management access | `your-management-key` |

## Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCKER_HOST` | `unix:///var/run/docker.sock` | Docker socket path for container management |
| `DASHBOARD_URL` | `http://localhost:3000` | Dashboard public URL |
| `API_URL` | — | CLIProxyAPI public URL |
| `POSTGRES_PASSWORD` | — | PostgreSQL password (used by docker-compose) |
| `NODE_ENV` | `production` | Node environment (`development` / `production`) |
| `LOG_LEVEL` | `info` | Logging verbosity (`debug`, `info`, `warn`, `error`) |
<!-- AUTO-GENERATED:ENV:END -->

## CLIProxyAPI Version (`CLIPROXYAPI_IMAGE_TAG`)

Set in `infrastructure/.env` (production) or the repo-root `.env` (local stack). Compose runs `eceasy/cli-proxy-api:${CLIPROXYAPI_IMAGE_TAG:-v8.0.29}`; the default is the release this dashboard was tested against. A new upstream release is only used when you choose it.

- **In-app switch** (Settings or the proxy update notification): pulls the chosen tag, writes `CLIPROXYAPI_IMAGE_TAG=<tag>` into the `.env` (no other line changes), and recreates the container. `docker compose up -d`, `rebuild.sh` and reboots keep that version. If the switch fails, the previous image and `.env` line are restored.
- **By hand**: edit the line, then `docker compose up -d cliproxyapi`.

The in-app switch needs the dashboard container (UID 1001) to write the file. The production compose file mounts `./.env` at `/opt/cliproxyapi/host.env`; the file must be owned by UID 1001:

```bash
cd infrastructure
sudo chown 1001 .env    # keep mode 600
docker compose up -d dashboard
```

`install.sh` does this unless UID 1001 is a real account on the host (that account would then own your secrets). Without a writable mount (dashboard-only stack, dev compose, wrong owner) the dashboard refuses to switch versions instead of switching to a version the next `docker compose up` would undo.

## Development Defaults

The `dev-local.ps1` / `dev-local.sh` scripts automatically copy `.env.development` to `.env.local` with pre-configured development values. No manual configuration needed for local development.
