# CLIProxyAPI Stack Installation Guide

Complete guide for deploying the CLIProxyAPI + Dashboard stack with Docker Compose, including automated installation, backup/restore, and systemd service management.

## Quick Start

For Ubuntu/Debian systems with root access:

```bash
sudo ./install.sh
```

The installer will:
1. Prompt for domain and subdomain configuration
2. Install Docker + Docker Compose (if needed)
3. Configure UFW firewall
4. Generate secure Docker secrets
5. Create systemd service for automatic startup
6. Setup automated backups (optional)

## Prerequisites

- **Operating System**: Ubuntu 20.04+ or Debian 11+
- **Root Access**: Required for Docker and firewall configuration
- **Domain**: A registered domain with DNS configured
- **Ports**: 80, 443, 8085, 1455, 54545, 51121, 11451 available

### DNS Configuration

Before installation, configure DNS A records:

```
dashboard.example.com  →  YOUR_SERVER_IP
api.example.com        →  YOUR_SERVER_IP
```

For OAuth callbacks, ensure your domain is accessible from the internet.

## Installation Process

### 1. Clone Repository

```bash
git clone <repository_url>
cd cliproxyapi_dashboard
```

### 2. Run Installer

```bash
sudo ./install.sh
```

### 3. Interactive Configuration

The installer will prompt for:

**Domain**: Your base domain (e.g., `example.com`)
- Required, cannot be empty
- Must be a valid domain format

**Dashboard Subdomain**: Default `dashboard`
- Full URL: `https://dashboard.example.com`

**API Subdomain**: Default `api`
- Full URL: `https://api.example.com`

**Backup Interval**:
- Daily: 2 AM every day, keeps last 7 backups
- Weekly: 2 AM every Sunday, keeps last 4 backups
- None: No automated backups

### 4. What Gets Installed

#### Docker Engine
- Docker CE (Community Edition)
- Docker Compose plugin
- Configured to start on boot

#### UFW Firewall Rules
- Port 22 (SSH) with rate limiting
- Port 80 (HTTP)
- Port 443 (HTTPS + HTTP/3)
- Ports 8085, 1455, 54545, 51121, 11451 (OAuth callbacks)

#### Environment Secrets
Generated and written to `infrastructure/.env`:
- `JWT_SECRET` (256-bit base64)
- `MANAGEMENT_API_KEY` (256-bit hex)
- `POSTGRES_PASSWORD` (256-bit base64)

**Security**: The `.env` file is `chmod 600`

#### Systemd Service
Unit file: `/etc/systemd/system/cliproxyapi-stack.service`
- Starts on boot
- Auto-restarts on failure
- Waits for Docker service

#### Backup Scripts
Located in `scripts/`:
- `backup.sh` - Create full backup
- `restore.sh` - Restore from backup
- `rotate-backups.sh` - Remove old backups

### 5. Post-Installation Configuration

#### Configure CLIProxyAPI

Edit `infrastructure/config/config.yaml` and replace `CHANGE_ME` values:

```yaml
api-keys:
  - "YOUR_GENERATED_API_KEY_1"
  - "YOUR_GENERATED_API_KEY_2"
```

Generate API keys:
```bash
openssl rand -hex 32
```

Add your AI provider credentials (Gemini, Claude, Codex, etc.) following the examples in the config file.

#### Start the Stack

```bash
sudo systemctl start cliproxyapi-stack
```

Or manually:
```bash
cd infrastructure
docker compose up -d --wait
```

#### Verify Services

Check systemd status:
```bash
sudo systemctl status cliproxyapi-stack
```

Check Docker containers:
```bash
cd infrastructure
docker compose ps
```

View logs:
```bash
docker compose logs -f
```

Health check all services:
```bash
docker compose ps --format "table {{.Name}}\t{{.Status}}"
```

#### Access Services

- **Dashboard**: `https://dashboard.example.com`
- **API**: `https://api.example.com`

**Note**: On first startup, Caddy will automatically request Let's Encrypt TLS certificates for your domains.

## Manual Installation (Without install.sh)

If you prefer manual setup or need customization:

### 1. Install Docker

```bash
# Update packages
sudo apt-get update

# Install prerequisites
sudo apt-get install -y ca-certificates curl gnupg lsb-release

# Add Docker GPG key
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Enable Docker
sudo systemctl enable docker
sudo systemctl start docker
```

### 2. Configure UFW

```bash
sudo apt-get install -y ufw

# SSH (prevent lockout)
sudo ufw limit 22/tcp

# HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow 443/udp

# OAuth callbacks
sudo ufw allow 8085/tcp
sudo ufw allow 1455/tcp
sudo ufw allow 54545/tcp
sudo ufw allow 51121/tcp
sudo ufw allow 11451/tcp

# Enable firewall
sudo ufw enable
```

### 3. Generate Secrets

```bash
# Generate secrets (store these values for the .env file)
JWT_SECRET=$(openssl rand -base64 32)
MANAGEMENT_API_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -hex 32)

echo "JWT_SECRET=$JWT_SECRET"
echo "MANAGEMENT_API_KEY=$MANAGEMENT_API_KEY"
echo "POSTGRES_PASSWORD=$POSTGRES_PASSWORD"
```

### 4. Create .env File

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
TZ=UTC
DASHBOARD_URL=https://dashboard.example.com
API_URL=https://api.example.com
EOF

chmod 600 infrastructure/.env
```

### 5. Configure config.yaml

Edit `infrastructure/config/config.yaml` and replace CHANGE_ME values with your API keys and provider credentials.

### 6. Create Systemd Service

```bash
sudo tee /etc/systemd/system/cliproxyapi-stack.service > /dev/null << EOF
[Unit]
Description=CLIProxyAPI Stack (Docker Compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=true
WorkingDirectory=/path/to/cliproxyapi_dashboard/infrastructure
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

# Update WorkingDirectory in the file above to match your installation path

sudo systemctl daemon-reload
sudo systemctl enable cliproxyapi-stack
```

## Service Management

### Systemd Commands

```bash
sudo systemctl start cliproxyapi-stack
sudo systemctl stop cliproxyapi-stack
sudo systemctl restart cliproxyapi-stack
sudo systemctl status cliproxyapi-stack

sudo systemctl enable cliproxyapi-stack
sudo systemctl disable cliproxyapi-stack
```

### Docker Compose Commands

```bash
cd infrastructure

docker compose up -d
docker compose down
docker compose restart
docker compose ps

docker compose logs -f
docker compose logs -f caddy
docker compose logs -f cliproxyapi
docker compose logs -f dashboard

docker compose exec cliproxyapi sh
docker compose exec postgres psql -U cliproxyapi -d cliproxyapi
```

## Backup and Restore

### Create Backup

```bash
./scripts/backup.sh
```

Backup location: `backups/cliproxyapi_backup_YYYYMMDD_HHMMSS.tar.gz`

### Restore from Backup

```bash
./scripts/restore.sh backups/cliproxyapi_backup_20260205_020000.tar.gz
```

### Automated Backups

Configured during installation via cron:

- **Daily**: `0 2 * * *` (2 AM every day)
- **Weekly**: `0 2 * * 0` (2 AM every Sunday)

View cron jobs:
```bash
sudo crontab -l
```

View backup logs:
```bash
tail -f backups/backup.log
```

## Troubleshooting

### Services Not Starting

Check systemd status:
```bash
sudo systemctl status cliproxyapi-stack
```

Check Docker logs:
```bash
cd infrastructure
docker compose logs
```

### Database Connection Errors

Verify Postgres is healthy:
```bash
docker compose ps postgres
docker compose exec postgres pg_isready -U cliproxyapi
```

Check database password in .env:
```bash
grep POSTGRES_PASSWORD infrastructure/.env
```

### OAuth Callbacks Failing

Verify firewall rules:
```bash
sudo ufw status numbered
```

Ensure OAuth ports are accessible:
```bash
nc -zv YOUR_SERVER_IP 8085
```

### TLS Certificate Issues

Check Caddy logs:
```bash
docker compose logs caddy
```

Verify DNS records are pointing to server:
```bash
dig dashboard.example.com
dig api.example.com
```

### Port Already in Use

Find process using port:
```bash
sudo lsof -i :80
sudo lsof -i :443
```

Stop conflicting service:
```bash
sudo systemctl stop nginx
sudo systemctl stop apache2
```

## Security Best Practices

1. **Keep secrets secure**
   - Never commit `.env` to git
   - Rotate secrets regularly
   - Use different secrets for dev/prod

2. **Firewall management**
   - Only open required ports
   - Use `ufw limit` for SSH (rate limiting)
   - Consider IP whitelisting for SSH

3. **Regular updates**
   ```bash
   docker compose pull
   docker compose up -d
   ```

4. **Monitor logs**
   ```bash
   docker compose logs -f --tail=100
   ```

5. **Backup regularly**
   - Test restore procedures
   - Store backups off-server
   - Encrypt backups for remote storage

## Uninstallation

To completely remove the stack:

```bash
cd infrastructure
docker compose down -v

sudo systemctl stop cliproxyapi-stack
sudo systemctl disable cliproxyapi-stack
sudo rm /etc/systemd/system/cliproxyapi-stack.service
sudo systemctl daemon-reload

sudo crontab -l | grep -v backup.sh | sudo crontab -

sudo ufw delete allow 8085/tcp
sudo ufw delete allow 1455/tcp
sudo ufw delete allow 54545/tcp
sudo ufw delete allow 51121/tcp
sudo ufw delete allow 11451/tcp

rm -f infrastructure/.env
rm -rf backups
```

## Support

For issues and questions:
- Check Docker logs: `docker compose logs -f`
- Review UFW setup: `infrastructure/docs/ufw-setup.md`
- CLIProxyAPI docs: https://github.com/router-for-me/CLIProxyAPI
