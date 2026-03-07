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

## Development Defaults

The `dev-local.ps1` / `dev-local.sh` scripts automatically copy `.env.development` to `.env.local` with pre-configured development values. No manual configuration needed for local development.
