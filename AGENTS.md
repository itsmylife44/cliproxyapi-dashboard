# AGENTS.md

## Cursor Cloud specific instructions

### Overview

CLIProxyAPI Dashboard — a Next.js 16 web dashboard for managing CLIProxyAPI, an AI API proxy service. The primary development target is the `dashboard/` directory.

### Services

| Service | How to start | Port |
|---------|-------------|------|
| PostgreSQL 16 | `docker compose -f dashboard/docker-compose.dev.yml up -d` | 5433 |
| CLIProxyAPI | (started by same docker compose) | 28317 |
| Dashboard (Next.js) | `cd dashboard && npm run dev` | 3000 |

Docker must be running before starting containers. The dev-local.sh script automates the full sequence but can also be done manually.

### Quick reference

- **Install deps**: `cd dashboard && npm install`
- **Lint**: `npm run lint` (pre-existing ESLint 10 + eslint-plugin-react compatibility error — runs but crashes; this is a known upstream issue)
- **Test**: `npm run test` (Vitest, 33 tests)
- **Dev server**: `npm run dev` (port 3000)
- **Prisma generate**: `npx prisma generate` (required after schema changes)
- **Prisma migrate**: `DATABASE_URL="postgresql://cliproxyapi:devpassword@localhost:5433/cliproxyapi" npx prisma migrate deploy`

### Non-obvious caveats

- **Node.js 20 required**: The project targets Node 20 (Alpine base in Dockerfile). Use `nvm use 20` if the system default is different.
- **Docker-in-Docker**: In Cloud Agent VMs, Docker requires `fuse-overlayfs` storage driver and `iptables-legacy`. The daemon must be started with `sudo dockerd` and socket permissions set with `sudo chmod 666 /var/run/docker.sock`.
- **Prisma bootstrap on fresh DB**: On a brand-new database, run `npx prisma db push --accept-data-loss` first, then mark all existing migrations as applied (see `dev-local.sh` for the full list), then `npx prisma migrate deploy`. The `dev-local.sh` script handles this automatically.
- **DATABASE_URL**: Must be exported for Prisma CLI commands: `postgresql://cliproxyapi:devpassword@localhost:5433/cliproxyapi`
- **`.env.local`**: Copy from `.env.development` and set `DOCKER_HOST=unix:///var/run/docker.sock` for Linux environments. The `dev-local.sh` script does this automatically.
- **First-time setup**: Navigate to `http://localhost:3000` after starting the dev server — it presents a registration form to create the first admin user.
- **CLIProxyAPI image**: The `eceasy/cli-proxy-api-plus:latest` Docker image is pulled from Docker Hub. It may take time on first pull (~100MB).
