# Installation Guide

← [Back to README](../README.md)

## Prerequisites

Before installing, ensure you have:

> **Local use (macOS/Windows/Linux)**: Only Docker Desktop is required. See [Local Setup](#local-setup-macos--windows--linux).

**For server deployment:**

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

![DNS Configuration](code-snippets/dns-config.png)

Replace `example.com` with your actual domain and `YOUR_SERVER_IP` with your server's public IP address.

> **Critical**: DNS records must be live before first start. Caddy requests Let's Encrypt certificates immediately, which requires valid DNS.

> **Security Note**: Until you create the first admin account, the dashboard setup page is accessible to anyone who can reach your domain. Restrict access using firewall rules if needed, or complete setup immediately after installation.

## Quick Start (Docker Compose)

The fastest way to get started is using the automated installer:

```bash
git clone https://github.com/itsmylife44/cliproxyapi-dashboard.git
cd cliproxyapi-dashboard
sudo ./install.sh
```

![Quick Start](code-snippets/quick-start.png)

The installer will:
1. Prompt for domain and subdomain configuration
2. Install Docker and Docker Compose (if not already installed)
3. Configure UFW firewall with required ports
4. Generate secure secrets (JWT_SECRET, MANAGEMENT_API_KEY, POSTGRES_PASSWORD)
5. Pull the pre-built dashboard image from GHCR
6. Create `infrastructure/.env` with all required configuration
7. Create a systemd service for automatic startup on boot
8. Optionally set up automated daily or weekly backups

### Post-Installation

After installation completes:

```bash
sudo systemctl start cliproxyapi-stack
sudo systemctl status cliproxyapi-stack
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

## Local Setup (macOS / Windows / Linux)

Run the full stack locally using Docker Desktop — no server, domain, or TLS required.

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### macOS / Linux

```bash
git clone https://github.com/itsmylife44/cliproxyapi-dashboard.git
cd cliproxyapi-dashboard
./setup-local.sh
./setup-local.sh --down    # Stop
./setup-local.sh --reset   # Reset (removes all data)
```

![Local Setup macOS](code-snippets/local-setup-mac.png)

### Windows (PowerShell)

```powershell
git clone https://github.com/itsmylife44/cliproxyapi-dashboard.git
cd cliproxyapi-dashboard
.\setup-local.ps1
.\setup-local.ps1 -Down    # Stop
.\setup-local.ps1 -Reset   # Reset (removes all data)
```

![Local Setup Windows](code-snippets/local-setup-windows.png)

Dashboard runs on `localhost:3000`, CLIProxyAPIPlus proxy on `localhost:11451`.

## Manual Installation

If you prefer manual setup or need customization:

### 1. Install Docker

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

### 2. Configure Firewall

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

### 3. Generate Secrets

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

### 4. Create Environment File

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

![Environment Setup](code-snippets/env-setup.png)

Replace `example.com` with your actual domain.

> **Critical**: The `infrastructure/.env` file is generated by `install.sh` and must contain all variables shown above. An empty or missing `.env` file will cause the stack to fail on startup. Do not commit this file to version control.

### 5. Configure CLIProxyAPIPlus

API keys and AI providers can be configured through the Dashboard UI after first login. Alternatively, you can edit `infrastructure/config/config.yaml` directly.

### 6. Create Systemd Service

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

### 7. Start the Stack

```bash
sudo systemctl start cliproxyapi-stack
```

Or manually:
```bash
cd infrastructure
docker compose up -d --wait
```
