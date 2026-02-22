<p align="center">
  <img src="docs/screenshots/1.png" alt="CLIProxyAPI Dashboard" width="800">
</p>

<h1 align="center">CLIProxyAPI Dashboard</h1>

<p align="center">
  <strong>Use Claude Code, Gemini CLI, and Codex as OpenAI-compatible APIs — managed through a modern web dashboard.</strong>
</p>

<p align="center">
  <a href="https://github.com/itsmylife44/cliproxyapi-dashboard/releases"><img src="https://img.shields.io/github/v/release/itsmylife44/cliproxyapi-dashboard" alt="Release"></a>
  <a href="https://github.com/itsmylife44/cliproxyapi-dashboard/actions/workflows/release.yml"><img src="https://github.com/itsmylife44/cliproxyapi-dashboard/actions/workflows/release.yml/badge.svg" alt="Build"></a>
  <a href="https://github.com/itsmylife44/cliproxyapi-dashboard/pkgs/container/cliproxyapi-dashboard%2Fdashboard"><img src="https://img.shields.io/badge/Docker-GHCR-blue?logo=docker" alt="Docker"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="License: MIT"></a>
  <img src="https://img.shields.io/badge/Next.js-16-black?logo=next.js" alt="Next.js 16">
  <img src="https://img.shields.io/badge/React-19-blue?logo=react" alt="React 19">
  <img src="https://img.shields.io/badge/TypeScript-5-blue?logo=typescript" alt="TypeScript">
</p>

---

## What is this?

[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) wraps OAuth-based CLI tools (Claude Code, Gemini CLI, Codex, Antigravity, Kimi, Qwen) into **OpenAI-compatible APIs**. This dashboard gives you a web UI to manage everything — providers, API keys, configs, logs, and updates — without touching YAML files.

## Quick Start

> **Local use (macOS/Windows/Linux)**: Only Docker Desktop required.

```bash
git clone https://github.com/itsmylife44/cliproxyapi-dashboard.git
cd cliproxyapi-dashboard
./setup-local.sh          # macOS/Linux
# .\setup-local.ps1       # Windows
```

Open **http://localhost:3000** → create admin account → done.

> **Server deployment**: See the full [Installation Guide](docs/INSTALLATION.md).

## Features

- **Visual Configuration** — Manage CLIProxyAPI settings through structured forms, no YAML editing
- **Multi-Provider OAuth** — Connect Claude, Gemini, Codex, Antigravity, iFlow, Kimi, and Qwen accounts
- **Custom Providers** — Add any OpenAI-compatible endpoint (OpenRouter, Ollama, etc.) with model mappings
- **API Key Management** — Create, revoke, and track API keys with per-user ownership
- **Real-time Monitoring** — Live log streaming, container health, and service management
- **Quota Tracking** — Rate limits and usage per provider (Claude, Codex, Kimi, Antigravity)
- **Usage Analytics** — Request counts, provider breakdown, model stats, error rates
- **Config Sync** — Auto-sync OpenCode configs via the [`opencode-cliproxyapi-sync`](https://github.com/itsmylife44/opencode-cliproxyapi-sync) plugin
- **Config Sharing** — Share model configs with others via share codes (`XXXX-XXXX`)
- **One-Click Updates** — Update both Dashboard (GHCR) and CLIProxyAPI (Docker Hub) from the admin panel
- **Container Management** — Start, stop, restart containers directly from the UI
- **Automatic TLS** — Let's Encrypt certificates via Caddy, auto-renewed

## Screenshots

<p align="center">
  <img src="docs/screenshots/1.png" alt="Dashboard" width="700">
</p>

<p align="center">
  <img src="docs/screenshots/2.png" alt="Dashboard" width="700">
</p>

## Architecture

Five Docker containers, two isolated networks:

<p align="center">
  <img src="docs/code-snippets/architecture.png" alt="Architecture" width="700">
</p>

| Service | Role |
|---------|------|
| **Caddy** | Reverse proxy, automatic TLS, HTTP/3 |
| **Dashboard** | Next.js web app, JWT auth, Docker management via socket proxy |
| **CLIProxyAPI** | AI proxy server, OAuth callbacks, management API |
| **Docker Socket Proxy** | Restricted Docker API access (containers/images only) |
| **PostgreSQL** | Database on isolated internal network |

## Project Structure

<p align="center">
  <img src="docs/code-snippets/project-structure.png" alt="Project Structure" width="600">
</p>

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Framework | Next.js 16 (App Router) |
| UI | React 19 |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL 16 + Prisma 7 |
| Auth | JWT (jose) + bcrypt |
| Container Mgmt | Docker CLI via socket proxy |

## Development

```bash
cd dashboard
./dev-local.sh              # Start dev environment
./dev-local.sh --reset      # Reset database
./dev-local.sh --down       # Stop containers
```

Or manually:

```bash
cd dashboard
npm install
cp .env.example .env.local  # Edit with your DB credentials
npx prisma migrate dev
npm run dev
```

Dashboard at `http://localhost:3000`.

## Documentation

| Guide | Description |
|-------|-------------|
| **[Installation](docs/INSTALLATION.md)** | Server deployment, local setup, manual installation |
| **[Configuration](docs/CONFIGURATION.md)** | Environment variables, config.yaml, config sync |
| **[Troubleshooting](docs/TROUBLESHOOTING.md)** | Common issues and solutions |
| **[Security](docs/SECURITY.md)** | Best practices for production |
| **[Backup & Restore](docs/BACKUP.md)** | Automated and manual backups |
| **[Service Management](docs/SERVICE-MANAGEMENT.md)** | Systemd and Docker Compose commands |

## Contributing

1. Fork → feature branch → PR
2. Use [Conventional Commits](https://www.conventionalcommits.org/) (`feat:`, `fix:`, `chore:`)
3. Test locally before submitting

Release-Please auto-generates releases from commit messages.

## Support

- **[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI)** — Core proxy documentation
- **[Issues](https://github.com/itsmylife44/cliproxyapi-dashboard/issues)** — Bug reports and feature requests
- **[Discussions](https://github.com/itsmylife44/cliproxyapi-dashboard/discussions)** — Questions and community

## Star History

<a href="https://star-history.com/#itsmylife44/cliproxyapi-dashboard&Date">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=itsmylife44/cliproxyapi-dashboard&type=Date&theme=dark" />
    <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=itsmylife44/cliproxyapi-dashboard&type=Date" />
    <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=itsmylife44/cliproxyapi-dashboard&type=Date" />
  </picture>
</a>

## License

[MIT](LICENSE)

---

<p align="center">
  Built with ❤️ using Next.js, React, and Tailwind CSS
</p>
