# CLIProxyAPI Dashboard

A modern web-based management interface for [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI), featuring real-time monitoring, structured configuration, API key management, and OAuth provider integration.

![CLIProxyAPI Dashboard](docs/screenshots/1.png)

## What is CLIProxyAPI?

[CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI) is an AI proxy server that wraps OAuth-based CLI tools—such as Claude Code, Gemini CLI, and Antigravity/Codex—into OpenAI-compatible APIs. This allows you to use these powerful AI tools programmatically with a standard OpenAI API interface, enabling seamless integration with existing tools and workflows.

## What is CLIProxyAPI Dashboard?

The CLIProxyAPI Dashboard is a comprehensive web management interface that provides:

- **Visual Configuration Management**: Structured forms for managing CLIProxyAPI settings instead of manual YAML editing
- **Real-time Monitoring**: Live logs, service health status, and container management
- **API Key Management**: Create, view, and revoke API keys through an intuitive interface
- **OAuth Provider Management**: Connect and manage Claude, Gemini, and Codex OAuth accounts
- **Usage Analytics**: Track API usage, request patterns, and provider statistics
- **Service Updates**: One-click updates for CLIProxyAPI from Docker Hub
- **Dynamic OpenCode Configuration**: Generate OpenCode config snippets for quick integration
- **Config Sync**: Automatically sync OpenCode and Oh-My-OpenCode configurations to your machine via the companion plugin

Built with **Next.js 16**, **React 19**, **Tailwind CSS v4**, **Prisma**, and **PostgreSQL**, the dashboard provides a modern, responsive interface with a glassmorphic dark theme.

## Features

### Core Features
- **Real-time Service Monitoring**: Live log streaming with filtering and container health status
- **Structured Configuration Editor**: Form-based configuration management with validation
- **API Key Management**: Full lifecycle management for API keys
- **Multi-Provider Support**: Claude Code, Gemini, OpenAI/Codex, and OpenAI-compatible endpoints
- **Custom Providers**: Add your own OpenAI-compatible providers (OpenRouter, Ollama, custom endpoints) with model mappings
- **OAuth Account Management**: Connect and manage OAuth sessions for Claude, Gemini, and Codex
- **Per-User Provider Ownership**: Users contribute their own API keys to the shared pool with ownership tracking
- **Usage Statistics**: Comprehensive usage tracking and analytics
- **Config Sync**: Auto-sync OpenCode configs via sync tokens and the `opencode-cliproxyapi-sync` plugin
- **Config Sharing**: Publishers share their model configurations via share codes, subscribers auto-sync
- **Dynamic Config Generation**: Auto-generate `opencode.json` and `oh-my-opencode.json` with provider-aware model selection
- **Model Selection UI**: Enable/disable individual models from config generation with per-user preferences
- **OAuth Model Detection**: Automatically detects OAuth-connected providers and includes their models in generated configs

### Management Features
- **Container Management**: Start, stop, restart containers directly from the dashboard
- **Service Updates**: Pull latest images and update services with one click
- **Health Monitoring**: Real-time health checks for all services
- **Log Viewer**: Filterable, real-time log streaming from all containers

### Technical Features
- **Secure Authentication**: JWT-based authentication with bcrypt password hashing
- **Docker Integration**: Direct Docker socket access for container management
- **Automatic TLS**: Let's Encrypt certificate provisioning via Caddy
- **Database Persistence**: PostgreSQL for session storage and user management
- **Responsive Design**: Mobile-first, glassmorphic dark-themed UI
- **Prisma ORM with Migrations**: Database schema management with versioned migrations

## Screenshots

![Dashboard Screenshot 1](docs/screenshots/1.png)

![Dashboard Screenshot 2](docs/screenshots/2.png)

## Prerequisites

Before installing, ensure you have:

- **Operating System**: Ubuntu 20.04+ or Debian 11+ (other Linux distributions should work with minor adjustments)
- **Root Access**: Required for Docker and firewall configuration
- **Domain Name**: A registered domain with DNS control
- **Server**: VPS or dedicated server with public IP address
- **Ports Available**: 80, 443, 8085, 1455, 54545, 51121, 11451

### Preflight Checklist

Complete **before** running the installer:

- [ ] **DNS Records Configured**: Set A records for `dashboard.yourdomain.com` and `api.yourdomain.com` pointing to your server IP
- [ ] **DNS Propagated**: Verify records with `dig dashboard.yourdomain.com` (allow 5-15 minutes)
- [ ] **Ports Available**: Confirm no services using ports 80, 443, 8085, 1455, 54545, 51121, 11451
- [ ] **Root Access**: SSH access with `sudo` or root privileges
- [ ] **First Admin Window**: Plan to create your admin account immediately after installation completes

### DNS Configuration

Configure DNS A records for your domain **before installation**:

```
dashboard.example.com  →  YOUR_SERVER_IP
api.example.com        →  YOUR_SERVER_IP
```

Replace `example.com` with your actual domain and `YOUR_SERVER_IP` with your server's public IP address.

> **Critical**: DNS records must be live before first start. Caddy requests Let's Encrypt certificates immediately, which requires valid DNS.

> **Security Note**: Until you create the first admin account, the dashboard setup page is accessible to anyone who can reach your domain. Restrict access using firewall rules if needed, or complete setup immediately after installation.

## Quick Start (Docker Compose)

The fastest way to get started is using the automated installer:

```bash
# Clone the repository
git clone https://github.com/itsmylife44/cliproxyapi_dashboard.git
cd cliproxyapi_dashboard

# Run the installer (Ubuntu/Debian with root access)
sudo ./install.sh
```

The installer will:
1. Prompt for domain and subdomain configuration
2. Install Docker and Docker Compose (if not already installed)
3. Configure UFW firewall with required ports
4. Generate secure secrets (JWT_SECRET, MANAGEMENT_API_KEY, POSTGRES_PASSWORD)
5. Create `infrastructure/.env` with all required configuration
6. Create a systemd service for automatic startup on boot
7. Optionally set up automated daily or weekly backups

> **Note**: The installer generates `infrastructure/.env` automatically. This file must not be empty or missing for the stack to start.

### Post-Installation

After installation completes:

```bash
# Start the stack
sudo systemctl start cliproxyapi-stack

# Check service status
sudo systemctl status cliproxyapi-stack

# View logs
cd infrastructure
docker compose logs -f
```

Access the dashboard at:
- **Dashboard**: `https://dashboard.yourdomain.com`
- **API**: `https://api.yourdomain.com`

### Initial Setup Flow

1. **First Visit**: Navigate to `https://dashboard.yourdomain.com`
2. **Automatic Redirect**: You'll be redirected to `/setup` (the setup wizard)
3. **Create Admin Account**: Enter your desired username and password
4. **Setup Disabled**: After creating the first user, the setup page becomes inaccessible
5. **Login**: Use your new credentials to access the dashboard

**Important Notes**:
- There are no default credentials
- The setup page is publicly accessible until the first admin account is created
- After first user creation, setup is permanently disabled
- Use the **Configuration** page to set up API keys and AI providers — no manual file editing required

> **Security**: Complete the setup wizard immediately after installation to secure your dashboard. Consider restricting access to port 443 via firewall until setup is complete.

> **TLS Certificates**: Caddy automatically requests Let's Encrypt certificates on first startup. DNS records must be correctly configured and propagated before starting the stack.

## Installation

### Automated Installation

For Ubuntu/Debian systems, the automated installer handles everything:

```bash
sudo ./install.sh
```

The script will guide you through:
- Domain configuration (base domain, dashboard subdomain, API subdomain)
- Docker installation (if needed)
- Firewall setup with UFW
- Secret generation (JWT_SECRET, MANAGEMENT_API_KEY, POSTGRES_PASSWORD)
- Systemd service creation
- Automated backup configuration (optional)

### Manual Installation

If you prefer manual setup or need customization:

#### 1. Install Docker

**Ubuntu:**
```bash
# Update packages
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker
```

**Debian:**
```bash
# Update packages
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/debian/gpg | \
  sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository (note: debian instead of ubuntu)
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/debian $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io \
  docker-buildx-plugin docker-compose-plugin

# Enable and start Docker
sudo systemctl enable docker
sudo systemctl start docker
```

> **Note**: The automated installer (`install.sh`) detects your OS via `/etc/os-release` and uses the correct repository path automatically.

#### 2. Configure Firewall

```bash
sudo apt-get install -y ufw

# Allow SSH (prevent lockout)
sudo ufw limit 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp  # HTTP/3

# Allow OAuth callback ports
sudo ufw allow 8085/tcp
sudo ufw allow 1455/tcp
sudo ufw allow 54545/tcp
sudo ufw allow 51121/tcp
sudo ufw allow 11451/tcp

# Enable firewall
sudo ufw enable
```

#### 3. Generate Secrets

```bash
# Generate secure secrets
JWT_SECRET=$(openssl rand -base64 32)
MANAGEMENT_API_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 32)

# Display secrets (save these values)
echo "JWT_SECRET=$JWT_SECRET"
echo "MANAGEMENT_API_KEY=$MANAGEMENT_API_KEY"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
```

#### 4. Create Environment File

```bash
cat > infrastructure/.env << EOF
DOMAIN=example.com
DASHBOARD_SUBDOMAIN=dashboard
API_SUBDOMAIN=api
DATABASE_URL=postgresql://cliproxyapi:${POSTGRES_PASSWORD}@postgres:5432/cliproxyapi
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
JWT_SECRET=${JWT_SECRET}
MANAGEMENT_API_KEY=${MANAGEMENT_API_KEY}
CLIPROXYAPI_MANAGEMENT_URL=http://cliproxyapi:8317/v0/management
INSTALL_DIR=$(pwd)
TZ=UTC
DASHBOARD_URL=https://dashboard.example.com
API_URL=https://api.example.com
EOF

# Secure the environment file
chmod 600 infrastructure/.env
```

Replace `example.com` with your actual domain.

> **Critical**: The `infrastructure/.env` file is generated by `install.sh` and must contain all variables shown above. An empty or missing `.env` file will cause the stack to fail on startup. Do not commit this file to version control.

#### 5. Configure CLIProxyAPI

API keys and AI providers can be configured through the Dashboard UI after first login. Alternatively, you can edit `infrastructure/config/config.yaml` directly.

#### 6. Create Systemd Service

```bash
sudo tee /etc/systemd/system/cliproxyapi-stack.service > /dev/null << 'EOF'
[Unit]
Description=CLIProxyAPI Stack (Docker Compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=true
WorkingDirectory=/opt/cliproxyapi/infrastructure
ExecStart=/usr/bin/docker compose up -d --wait
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300
TimeoutStopSec=120
Restart=on-failure
RestartSec=10s
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF

# Update WorkingDirectory to match your installation path
sudo sed -i 's|/opt/cliproxyapi|'$(pwd)'|g' \
  /etc/systemd/system/cliproxyapi-stack.service

# Reload systemd and enable service
sudo systemctl daemon-reload
sudo systemctl enable cliproxyapi-stack
```

#### 7. Start the Stack

```bash
sudo systemctl start cliproxyapi-stack
```

Or manually:
```bash
cd infrastructure
docker compose up -d --wait
```

## Configuration

### Environment Variables

Configuration is managed through `infrastructure/.env`:

| Variable | Description | Example |
|----------|-------------|---------|
| `DOMAIN` | Base domain for your installation | `example.com` |
| `DASHBOARD_SUBDOMAIN` | Dashboard subdomain | `dashboard` |
| `API_SUBDOMAIN` | API subdomain | `api` |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:port/db` |
| `POSTGRES_PASSWORD` | PostgreSQL password | Generated by installer |
| `JWT_SECRET` | JWT signing secret | Generated by installer |
| `MANAGEMENT_API_KEY` | Management API authentication key | Generated by installer |
| `CLIPROXYAPI_MANAGEMENT_URL` | Internal management API URL | `http://cliproxyapi:8317/v0/management` |
| `TZ` | Server timezone | `UTC` |

### CLIProxyAPI Configuration

CLIProxyAPI configuration is in `infrastructure/config/config.yaml`. The dashboard provides a structured UI for editing this configuration, but you can also edit it manually:

```yaml
api-keys:
  - "sk-your-api-key-here"

providers:
  - name: "claude"
    type: "claude"
    # Provider-specific configuration...
  
  - name: "gemini"
    type: "gemini"
    api-key: "YOUR_GEMINI_API_KEY"
    # Provider-specific configuration...
```

### Dashboard Settings

Dashboard-specific settings are managed through the Settings page in the UI:
- User management (admin password)
- Config Sync token management
- Theme preferences

## Usage Guide

### Quick Start Page

The Quick Start page provides an overview and quick access to common tasks:
- View service health status and provider count
- Generate OpenCode configuration with provider-aware model selection
- Generate Oh-My-OpenCode configuration with tier-based agent/category assignments
- Enable/disable individual models from generated configs
- Auto-sync configs via the `opencode-cliproxyapi-sync` plugin

### Monitoring Dashboard

Real-time monitoring with:
- **Service Status**: Container health, uptime, and resource usage
- **Live Logs**: Real-time log streaming with filtering by service and log level
- **Container Management**: Start, stop, restart containers
- **Service Updates**: Pull latest images and update services

### Configuration Editor

Structured configuration management:
- **API Keys**: Add/remove CLIProxyAPI API keys
- **Providers**: Configure AI providers (Claude, Gemini, OpenAI, etc.)
- **Server Settings**: General server configuration
- **Validation**: Real-time configuration validation before saving

### API Key Management

Manage dashboard API keys (not CLIProxyAPI API keys):
- Create new API keys with descriptive names
- View existing keys and creation dates
- Revoke keys instantly
- Copy keys to clipboard

### Provider Management

Manage AI provider connections:
- **OAuth Accounts**: Connect Claude, Gemini, and Codex OAuth accounts
- **API Key Contribution**: Add your own API keys to the shared provider pool
- **Custom Providers**: Define your own OpenAI-compatible providers:
  - Configure base URL and API key
  - Map upstream model names to friendly aliases
  - Set excluded models with wildcard patterns (e.g., `gpt-4*`)
  - Optional: prefix, proxy URL, custom headers
- **Ownership Tracking**: See which keys/accounts you own vs. others (anonymized)
- **Provider Status**: View connection status and account details
- **Account Management**: Add/remove/reconnect OAuth accounts (only your own)
- **Usage Tracking**: Per-provider usage statistics

### Config Sharing

Share your configuration with others:
- **Publish**: Generate a unique share code (format: `XXXX-XXXX`) for your config
- **Subscribe**: Enter a share code to sync with a publisher's model selection
- **Automatic Sync**: Subscribers see publisher's models on page reload
- **Subscriber Isolation**: Subscribers keep their own MCP servers and plugins
- **Mutual Exclusivity**: Users can be either publisher OR subscriber, not both

### Usage Statistics

Comprehensive usage analytics:
- **Request Counts**: Total requests by time period
- **Provider Breakdown**: Usage by AI provider
- **Model Statistics**: Most used models
- **Error Rates**: Success/failure metrics
- **Time Series**: Usage trends over time

### Settings

System settings and administration:
- **User Management**: Change admin password
- **Config Sync**: Generate and manage sync tokens for automatic config synchronization with the `opencode-cliproxyapi-sync` OpenCode plugin
- **System Configuration**: Update dashboard settings
- **Backup/Restore**: Manage backups (if automated backups enabled)
- **About**: Version information and links

## Architecture

The CLIProxyAPI Dashboard stack consists of four Docker containers:

```
                                   Internet
                                      |
                                   [Caddy]
                                   (HTTPS/TLS)
                                      |
                    +----------------+------------------+
                    |                                   |
            [Dashboard:3000]                    [CLIProxyAPI:8317]
                    |                                   |
                    +----------------+------------------+
                                     |
                              [PostgreSQL:5432]
```

### Services

- **Caddy**: Reverse proxy with automatic Let's Encrypt TLS certificates
  - Handles HTTPS termination
  - Routes requests to Dashboard and CLIProxyAPI
  - Supports HTTP/3

- **Dashboard**: Next.js web application
  - Provides management UI
  - Authenticates users with JWT
  - Proxies management API calls to CLIProxyAPI
  - Has Docker socket access for container management

- **CLIProxyAPI**: AI proxy server
  - Wraps OAuth CLI tools as OpenAI-compatible APIs
  - Exposes management API on port 8317
  - Handles OAuth callbacks on ports 8085, 1455, 54545, 51121, 11451

- **PostgreSQL**: Database
  - Stores user sessions and dashboard data
  - On isolated internal network (no internet access)

### Networks

- **frontend**: Public network for Caddy ↔ Dashboard and Caddy ↔ CLIProxyAPI
- **backend**: Internal network for services ↔ PostgreSQL (no internet access)

### Volumes

- **postgres_data**: Database persistence
- **cliproxyapi_auths**: OAuth token storage
- **cliproxyapi_logs**: CLIProxyAPI logs
- **caddy_data**: TLS certificates
- **caddy_config**: Caddy configuration

## Development

To run the dashboard locally for development:

### Prerequisites

- Node.js 20+
- Docker & Docker Compose

### Quick Start (Recommended)

The easiest way to develop locally using Docker containers for PostgreSQL and CLIProxyAPI:

```bash
cd dashboard

# Start dev environment (PostgreSQL + CLIProxyAPI containers + Next.js dev server)
./dev-local.sh

# Reset database if needed
./dev-local.sh --reset

# Stop containers
./dev-local.sh --down
```

The dashboard will be available at `http://localhost:3000`.

### Manual Setup

If you prefer manual setup or need to connect to external services:

```bash
cd dashboard

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your database credentials

# Run database migrations
npx prisma migrate dev

# Start development server
npm run dev
```

### Tech Stack

- **Framework**: Next.js 16 (App Router)
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4
- **Database ORM**: Prisma 7
- **Database**: PostgreSQL 16
- **Authentication**: JWT (jose) + bcrypt
- **Container Management**: Docker SDK via socket

### Project Structure

```
cliproxyapi_dashboard/
├── dashboard/
│   ├── src/
│   │   ├── app/              # Next.js app router pages
│   │   ├── components/       # React components
│   │   ├── lib/              # Utility functions
│   │   │   └── config-generators/  # OpenCode & Oh-My-OpenCode config logic
│   │   ├── actions/          # Server actions
│   │   └── generated/        # Prisma client
│   ├── prisma/               # Database schema & migrations
│   ├── public/               # Static assets
│   └── Dockerfile            # Production build
├── infrastructure/           # Docker Compose, Caddy, config
├── scripts/                  # Backup/restore scripts
└── install.sh                # Automated installer
```

## Troubleshooting

### Services Not Starting

**Check systemd status:**
```bash
sudo systemctl status cliproxyapi-stack
```

**Check Docker container status:**
```bash
cd infrastructure
docker compose ps
```

**View logs:**
```bash
docker compose logs -f
```

### Database Connection Errors

**Verify PostgreSQL is healthy:**
```bash
docker compose ps postgres
docker compose exec postgres pg_isready -U cliproxyapi
```

**Check credentials in `.env`:**
```bash
grep -E 'POSTGRES_PASSWORD|DATABASE_URL' infrastructure/.env
```

### OAuth Callbacks Failing

**Verify firewall rules:**
```bash
sudo ufw status numbered
```

**Test OAuth port accessibility from external network:**
```bash
nc -zv YOUR_SERVER_IP 8085
nc -zv YOUR_SERVER_IP 1455
# ... test other OAuth ports
```

**Check CLIProxyAPI logs:**
```bash
docker compose logs -f cliproxyapi
```

### TLS Certificate Issues

**Check Caddy logs:**
```bash
docker compose logs caddy
```

**Verify DNS records:**
```bash
dig dashboard.example.com
dig api.example.com
```

**Common causes:**
- DNS records not propagated yet (wait 5-15 minutes)
- Firewall blocking ports 80/443
- Domain not pointing to correct IP
- Rate limit hit (Let's Encrypt has rate limits)

### Port Already in Use

**Find process using port:**
```bash
sudo lsof -i :80
sudo lsof -i :443
```

**Stop conflicting services:**
```bash
sudo systemctl stop nginx    # If using nginx
sudo systemctl stop apache2  # If using apache
```

### Dashboard Not Loading

**Check all services are healthy:**
```bash
docker compose ps
```

**Verify dashboard logs:**
```bash
docker compose logs dashboard
```

**Common issues:**
- Database not initialized (run `npx prisma migrate deploy` in container)
- JWT_SECRET not set in `.env`
- Dashboard container can't reach PostgreSQL

### Can't Login to Dashboard

There are no default credentials. The setup flow is:

1. **First Visit**: Navigate to `https://dashboard.yourdomain.com`
2. **Auto-Redirect**: You'll be redirected to `/setup` automatically
3. **Create Account**: Enter username and password to create the first admin user
4. **Setup Locked**: After first user is created, `/setup` becomes inaccessible

**If you forgot your password**, reset via the database:
```bash
cd infrastructure
docker compose exec postgres psql -U cliproxyapi -d cliproxyapi -c "DELETE FROM users;"
```
Then visit `/setup` again to create a new admin account.

**If setup page is not accessible**, it means an admin account already exists. Use your credentials to log in at the main login page.

## Security

### Best Practices

1. **Use a Strong Password**: Choose a strong password during the initial setup wizard

2. **Secure Environment File**:
   ```bash
   chmod 600 infrastructure/.env
   # Never commit .env to version control
   ```

3. **Rotate Secrets Regularly**:
   ```bash
   # Generate new secrets
   openssl rand -base64 32  # JWT_SECRET
   openssl rand -hex 32     # MANAGEMENT_API_KEY
   # Update .env and restart services
   ```

4. **Firewall Configuration**:
   - Only open required ports
   - Use `ufw limit` for SSH to enable rate limiting
   - Consider IP whitelisting for SSH access

5. **Regular Updates**:
   ```bash
   cd infrastructure
   docker compose pull
   docker compose up -d
   ```

6. **Monitor Logs**:
   ```bash
   docker compose logs -f --tail=100
   ```

7. **Automated Backups**:
   - Enable daily or weekly backups during installation
   - Store backups off-server
   - Test restore procedures regularly
   - Encrypt backups for remote storage

8. **Database Security**:
   - PostgreSQL is on isolated internal network (no internet access)
   - Use strong passwords for database credentials
   - Regularly update PostgreSQL image

9. **TLS Configuration**:
   - Caddy automatically provisions Let's Encrypt certificates
   - Certificates auto-renew before expiration
   - HTTPS enforced for all connections

## Config Sync

The dashboard can automatically sync your OpenCode configurations to your local machine using the companion plugin.

### How It Works

1. **Generate a Sync Token**: Navigate to Settings → Config Sync in the dashboard
2. **Install the Plugin**: Add `opencode-cliproxyapi-sync` to your OpenCode plugins
3. **Configure**: Create `~/.config/opencode-cliproxyapi-sync/config.json` with your dashboard URL and sync token
4. **Auto-Sync**: On every OpenCode startup, the plugin checks for config changes and updates your local `opencode.json` and `oh-my-opencode.json`

### Plugin Installation

```bash
npx opencode install opencode-cliproxyapi-sync
```

Or add manually to your `opencode.json`:
```json
{
  "plugin": [
    "opencode-cliproxyapi-sync",
    "oh-my-opencode@latest"
  ]
}
```

For full plugin documentation, see [opencode-cliproxyapi-sync](https://github.com/itsmylife44/opencode-cliproxyapi-sync).

## Backup and Restore

### Create Backup

```bash
./scripts/backup.sh
```

Backup includes:
- PostgreSQL database dump
- CLIProxyAPI configuration
- OAuth token storage
- Environment files
- TLS certificates

Backups are stored in `backups/cliproxyapi_backup_YYYYMMDD_HHMMSS.tar.gz`

### Restore from Backup

```bash
./scripts/restore.sh backups/cliproxyapi_backup_20260206_020000.tar.gz
```

The restore script will:
1. Stop all services
2. Restore database from dump
3. Restore configuration files
4. Restore volumes
5. Restart services

### Automated Backups

Configured during installation via cron:
- **Daily**: 2 AM every day, keeps last 7 backups
- **Weekly**: 2 AM every Sunday, keeps last 4 backups

**View cron schedule:**
```bash
sudo crontab -l
```

**View backup logs:**
```bash
tail -f backups/backup.log
```

## Service Management

### Systemd Commands

```bash
# Start the stack
sudo systemctl start cliproxyapi-stack

# Stop the stack
sudo systemctl stop cliproxyapi-stack

# Restart the stack
sudo systemctl restart cliproxyapi-stack

# View status
sudo systemctl status cliproxyapi-stack

# Enable auto-start on boot
sudo systemctl enable cliproxyapi-stack

# Disable auto-start
sudo systemctl disable cliproxyapi-stack
```

### Docker Compose Commands

```bash
cd infrastructure

# Start services
docker compose up -d

# Stop services
docker compose down

# Restart services
docker compose restart

# View running containers
docker compose ps

# View logs (all services)
docker compose logs -f

# View logs (specific service)
docker compose logs -f caddy
docker compose logs -f cliproxyapi
docker compose logs -f dashboard
docker compose logs -f postgres

# Execute command in container
docker compose exec cliproxyapi sh
docker compose exec dashboard sh
docker compose exec postgres psql -U cliproxyapi -d cliproxyapi

# Pull latest images
docker compose pull

# Update services
docker compose up -d --pull always
```

## License

[See LICENSE file]

## Contributing

Contributions are welcome! To contribute:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Follow existing code style and conventions
- Test changes locally before submitting PR
- Update documentation for new features
- Write clear commit messages

### Reporting Issues

When reporting issues, please include:
- Steps to reproduce
- Expected behavior
- Actual behavior
- Environment details (OS, Docker version, etc.)
- Relevant logs

## Support

- **CLIProxyAPI Documentation**: https://github.com/router-for-me/CLIProxyAPI
- **Issues**: Open an issue on GitHub
- **Discussions**: Use GitHub Discussions for questions and community support

## Acknowledgements

This dashboard builds upon [CLIProxyAPI](https://github.com/router-for-me/CLIProxyAPI), which provides the core proxy functionality. Development was accelerated with [OpenCode](https://opencode.ai/docs/config/), an AI-powered development tool that streamlines coding workflows.

---

Built with ❤️ using Next.js, React, and Tailwind CSS
