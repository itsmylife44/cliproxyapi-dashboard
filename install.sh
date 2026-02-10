#!/bin/bash
#
# CLIProxyAPI Stack Installation Script
# Installs Docker, Docker Compose, configures UFW, generates secrets, and sets up systemd service
#
# Usage: sudo ./install.sh
#

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Log functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Preflight conflict detection functions
check_port_conflict() {
    local port=$1
    
    # Try ss (preferred, available on most Linux systems)
    if command -v ss &> /dev/null; then
        if ss -tlnp 2>/dev/null | grep -q ":$port "; then
            echo "$port"
            return 0
        fi
    # Fallback to lsof
    elif command -v lsof &> /dev/null; then
        if lsof -i ":$port" 2>/dev/null | grep -q LISTEN; then
            echo "$port"
            return 0
        fi
    # Final fallback: try netstat
    elif command -v netstat &> /dev/null; then
        if netstat -tln 2>/dev/null | grep -q ":$port "; then
            echo "$port"
            return 0
        fi
    fi
    
    return 1
}

check_container_conflicts() {
    local container_names=("cliproxyapi-caddy" "cliproxyapi" "cliproxyapi-dashboard" "cliproxyapi-postgres")
    local conflicts=()
    
    # Only check if Docker is running
    if ! command -v docker &> /dev/null; then
        return 0
    fi
    
    if ! docker ps &> /dev/null 2>&1; then
        return 0
    fi
    
    for container in "${container_names[@]}"; do
        if docker ps -a --format '{{.Names}}' 2>/dev/null | grep -q "^${container}$"; then
            conflicts+=("$container")
        fi
    done
    
    if [ ${#conflicts[@]} -gt 0 ]; then
        printf '%s\n' "${conflicts[@]}"
    fi
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    log_error "This script must be run as root (use sudo)"
    exit 1
fi

# Detect installation directory (where script is located)
INSTALL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
log_info "Installation directory: $INSTALL_DIR"

# Check if running on Ubuntu/Debian
if ! command -v apt-get &> /dev/null; then
    log_error "This script only supports Ubuntu/Debian systems"
    exit 1
fi

# Detect Linux distribution and codename for Docker repo setup
if [ -f /etc/os-release ]; then
    . /etc/os-release
    DISTRO_ID="${ID:-}"
    DISTRO_CODENAME="${VERSION_CODENAME:-}"
else
    log_error "Cannot detect Linux distribution (/etc/os-release not found)"
    exit 1
fi

# Validate distro and set Docker repo URL
case "$DISTRO_ID" in
    ubuntu)
        DOCKER_REPO_URL="https://download.docker.com/linux/ubuntu"
        ;;
    debian)
        DOCKER_REPO_URL="https://download.docker.com/linux/debian"
        ;;
    *)
        log_error "Unsupported distribution: $DISTRO_ID (only Ubuntu and Debian supported)"
        exit 1
        ;;
esac

# Validate codename
if [ -z "$DISTRO_CODENAME" ]; then
    log_error "Cannot determine distribution codename (required for Docker repo)"
    exit 1
fi

log_info "Detected distribution: $DISTRO_ID ($DISTRO_CODENAME)"
log_info "Docker repository: $DOCKER_REPO_URL"

log_info "Starting CLIProxyAPI Stack installation..."
echo ""

# ============================================================================
# INTERACTIVE CONFIGURATION
# ============================================================================

log_info "=== Configuration ==="
echo ""

# Domain configuration
while true; do
    read -p "Enter your domain (e.g., example.com): " DOMAIN
    if [ -z "$DOMAIN" ]; then
        log_error "Domain cannot be empty"
        continue
    fi
    # Basic validation
    if [[ ! "$DOMAIN" =~ ^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$ ]]; then
        log_error "Invalid domain format"
        continue
    fi
    break
done

# Dashboard subdomain
read -p "Enter dashboard subdomain [default: dashboard]: " DASHBOARD_SUBDOMAIN
DASHBOARD_SUBDOMAIN="${DASHBOARD_SUBDOMAIN:-dashboard}"

# API subdomain
read -p "Enter API subdomain [default: api]: " API_SUBDOMAIN
API_SUBDOMAIN="${API_SUBDOMAIN:-api}"

# External reverse proxy support
echo ""
read -p "Use existing reverse proxy/Caddy? [y/N]: " EXTERNAL_PROXY_INPUT
if [[ "$EXTERNAL_PROXY_INPUT" =~ ^[Yy]$ ]]; then
    EXTERNAL_PROXY=1
else
    EXTERNAL_PROXY=0
fi

# OAuth provider support
echo ""
read -p "Enable OAuth provider callbacks? [y/N]: " OAUTH_ENABLED
if [[ "$OAUTH_ENABLED" =~ ^[Yy]$ ]]; then
    OAUTH_ENABLED=1
else
    OAUTH_ENABLED=0
fi

# Backup interval
echo ""
log_info "Select backup interval:"
echo "  1) Daily backups (keep last 7)"
echo "  2) Weekly backups (keep last 4)"
echo "  3) No automated backups"
while true; do
    read -p "Enter choice [1-3]: " BACKUP_CHOICE
    case $BACKUP_CHOICE in
        1)
            BACKUP_INTERVAL="daily"
            BACKUP_RETENTION=7
            break
            ;;
        2)
            BACKUP_INTERVAL="weekly"
            BACKUP_RETENTION=4
            break
            ;;
        3)
            BACKUP_INTERVAL="none"
            BACKUP_RETENTION=0
            break
            ;;
        *)
            log_error "Invalid choice"
            ;;
    esac
done

echo ""
log_info "Configuration summary:"
log_info "  Domain: $DOMAIN"
log_info "  Dashboard: ${DASHBOARD_SUBDOMAIN}.${DOMAIN}"
log_info "  API: ${API_SUBDOMAIN}.${DOMAIN}"
log_info "  External reverse proxy: $([ $EXTERNAL_PROXY -eq 1 ] && echo 'enabled' || echo 'disabled')"
log_info "  OAuth callbacks: $([ $OAUTH_ENABLED -eq 1 ] && echo 'enabled' || echo 'disabled')"
log_info "  Backup interval: $BACKUP_INTERVAL"
echo ""

read -p "Continue with installation? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    log_warning "Installation cancelled"
    exit 0
fi

echo ""

# ============================================================================
# PREFLIGHT CONFLICT CHECKS
# ============================================================================

log_info "=== Preflight Conflict Detection ==="
echo ""

# Define required ports (80/443 excluded if using external proxy)
REQUIRED_PORTS=()
if [ $EXTERNAL_PROXY -eq 0 ]; then
    REQUIRED_PORTS+=(80 443)
fi
if [ $OAUTH_ENABLED -eq 1 ]; then
    REQUIRED_PORTS+=(8085 1455 54545 51121 11451)
fi

# Check for port conflicts
if [ $EXTERNAL_PROXY -eq 1 ]; then
    log_info "External proxy mode: skipping ports 80/443 check"
    if [ $OAUTH_ENABLED -eq 1 ]; then
        log_info "Checking for OAuth callback port conflicts..."
    fi
else
    log_info "Checking for port conflicts..."
fi
PORT_CONFLICTS=()
for port in "${REQUIRED_PORTS[@]}"; do
    if conflict_port=$(check_port_conflict "$port"); then
        PORT_CONFLICTS+=("$conflict_port")
        log_warning "Port $port is already in use"
    fi
done

# Check for container conflicts
log_info "Checking for existing container names..."
CONTAINER_CONFLICTS=($(check_container_conflicts))
if [ ${#CONTAINER_CONFLICTS[@]} -gt 0 ]; then
    log_warning "Found existing containers with names that may conflict:"
    for container in "${CONTAINER_CONFLICTS[@]}"; do
        log_warning "  - $container"
    done
fi

# If conflicts found, ask for confirmation
if [ ${#PORT_CONFLICTS[@]} -gt 0 ] || [ ${#CONTAINER_CONFLICTS[@]} -gt 0 ]; then
    echo ""
    log_warning "=== CONFLICTS DETECTED ==="
    
    if [ ${#PORT_CONFLICTS[@]} -gt 0 ]; then
        echo "The following ports are already in use (required for this stack):"
        for port in "${PORT_CONFLICTS[@]}"; do
            echo "  - Port $port"
        done
        echo ""
    fi
    
    if [ ${#CONTAINER_CONFLICTS[@]} -gt 0 ]; then
        echo "The following Docker containers already exist:"
        for container in "${CONTAINER_CONFLICTS[@]}"; do
            echo "  - $container"
        done
        echo ""
    fi
    
    log_warning "These conflicts may cause installation to fail or disrupt existing services."
    read -p "Continue anyway? [y/N]: " OVERRIDE_CONFLICTS
    if [[ ! "$OVERRIDE_CONFLICTS" =~ ^[Yy]$ ]]; then
        log_error "Installation cancelled due to conflicts"
        echo ""
        log_info "To resolve conflicts, you may need to:"
        if [ ${#PORT_CONFLICTS[@]} -gt 0 ]; then
            echo "  - Stop other services using the conflicting ports"
            echo "  - Reconfigure this installation to use different ports"
        fi
        if [ ${#CONTAINER_CONFLICTS[@]} -gt 0 ]; then
            echo "  - Remove or rename existing containers (docker rename, docker rm)"
            echo "  - Use a different installation location/prefix"
        fi
        exit 1
    fi
    
    log_warning "Proceeding despite conflicts - installation may fail"
    echo ""
fi

# ============================================================================
# DOCKER INSTALLATION
# ============================================================================

log_info "=== Docker Installation ==="
echo ""

if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    log_success "Docker already installed: $DOCKER_VERSION"
    
    # Check if Docker Compose plugin is installed
    if docker compose version &> /dev/null; then
        COMPOSE_VERSION=$(docker compose version)
        log_success "Docker Compose already installed: $COMPOSE_VERSION"
    else
        log_warning "Docker Compose plugin not found, installing..."
        apt-get update
        apt-get install -y docker-compose-plugin
        log_success "Docker Compose plugin installed"
    fi
else
    log_info "Installing Docker..."
    
    # Update package index
    apt-get update
    
    # Install prerequisites
    apt-get install -y \
        ca-certificates \
        curl \
        gnupg \
        lsb-release
    
    # Add Docker GPG key
    install -m 0755 -d /etc/apt/keyrings
    curl -fsSL "$DOCKER_REPO_URL/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    
    # Add Docker repository
    echo \
        "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] $DOCKER_REPO_URL \
        $DISTRO_CODENAME stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    
    # Install Docker Engine
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
    # Enable and start Docker
    systemctl enable docker
    systemctl start docker
    
    log_success "Docker installed successfully"
fi

echo ""

# ============================================================================
# UFW FIREWALL CONFIGURATION
# ============================================================================

log_info "=== UFW Firewall Configuration ==="
echo ""

if ! command -v ufw &> /dev/null; then
    log_info "Installing UFW..."
    apt-get install -y ufw
fi

# Check if UFW is active
UFW_STATUS=$(ufw status | head -n 1)

if [[ "$UFW_STATUS" == *"inactive"* ]]; then
    log_info "Configuring UFW rules..."
    
    # SSH first to prevent lockout
    log_info "Allowing SSH (port 22) to prevent lockout..."
    ufw limit 22/tcp comment 'SSH with rate limiting'
    
    # HTTP/HTTPS (skip if using external reverse proxy)
    if [ $EXTERNAL_PROXY -eq 0 ]; then
        log_info "Allowing HTTP/HTTPS (ports 80, 443)..."
        ufw allow 80/tcp comment 'HTTP'
        ufw allow 443/tcp comment 'HTTPS'
        ufw allow 443/udp comment 'HTTP/3 (QUIC)'
    else
        log_info "Skipping HTTP/HTTPS rules (external proxy mode)"
    fi
    
    # OAuth callback ports (conditional)
    if [ $OAUTH_ENABLED -eq 1 ]; then
        log_info "Allowing OAuth callback ports..."
        ufw allow 8085/tcp comment 'CLIProxyAPI OAuth callback 1'
        ufw allow 1455/tcp comment 'CLIProxyAPI OAuth callback 2'
        ufw allow 54545/tcp comment 'CLIProxyAPI OAuth callback 3'
        ufw allow 51121/tcp comment 'CLIProxyAPI OAuth callback 4'
        ufw allow 11451/tcp comment 'CLIProxyAPI OAuth callback 5'
    fi
    
    # Enable UFW
    log_warning "Enabling UFW firewall..."
    echo "y" | ufw enable
    
    log_success "UFW configured and enabled"
else
    log_warning "UFW already active, checking rules..."
    
    # Add missing rules if needed
    RULES_ADDED=0
    
    # Helper function to check and add rule
    add_rule_if_missing() {
        local PORT=$1
        local PROTO=$2
        local COMMENT=$3
        
        if ! ufw status | grep -q "$PORT/$PROTO"; then
            ufw allow "$PORT/$PROTO" comment "$COMMENT"
            log_info "Added rule: $PORT/$PROTO"
            RULES_ADDED=1
        fi
    }
    
    add_rule_if_missing 22 tcp "SSH with rate limiting"
    if [ $EXTERNAL_PROXY -eq 0 ]; then
        add_rule_if_missing 80 tcp "HTTP"
        add_rule_if_missing 443 tcp "HTTPS"
        add_rule_if_missing 443 udp "HTTP/3 (QUIC)"
    fi
    
    # OAuth callback ports (conditional)
    if [ $OAUTH_ENABLED -eq 1 ]; then
        add_rule_if_missing 8085 tcp "CLIProxyAPI OAuth callback 1"
        add_rule_if_missing 1455 tcp "CLIProxyAPI OAuth callback 2"
        add_rule_if_missing 54545 tcp "CLIProxyAPI OAuth callback 3"
        add_rule_if_missing 51121 tcp "CLIProxyAPI OAuth callback 4"
        add_rule_if_missing 11451 tcp "CLIProxyAPI OAuth callback 5"
    fi
    
    if [ $RULES_ADDED -eq 0 ]; then
        log_success "All required UFW rules already configured"
    else
        ufw reload
        log_success "UFW rules updated"
    fi
fi

echo ""

# ============================================================================
# SECRET GENERATION
# ============================================================================

log_info "=== Secret Generation ==="
echo ""

JWT_SECRET=$(openssl rand -base64 32)
MANAGEMENT_API_KEY=$(openssl rand -hex 32)
POSTGRES_PASSWORD=$(openssl rand -base64 32)

log_success "Secrets generated"

echo ""

# ============================================================================
# ENVIRONMENT FILE CONFIGURATION
# ============================================================================

log_info "=== Environment Configuration ==="
echo ""

ENV_FILE="$INSTALL_DIR/infrastructure/.env"

if [ -f "$ENV_FILE" ]; then
    log_warning ".env file already exists"
    read -p "Overwrite .env file? [y/N]: " OVERWRITE_ENV
    if [[ ! "$OVERWRITE_ENV" =~ ^[Yy]$ ]]; then
        log_info "Keeping existing .env file"
        SKIP_ENV=1
    else
        SKIP_ENV=0
    fi
else
    SKIP_ENV=0
fi

if [ $SKIP_ENV -eq 0 ]; then
    log_info "Creating .env file..."

    cat > "$ENV_FILE" << EOF
# CLIProxyAPI Stack Environment Configuration
# Generated by install.sh on $(date)

# Domain configuration
DOMAIN=$DOMAIN
DASHBOARD_SUBDOMAIN=$DASHBOARD_SUBDOMAIN
API_SUBDOMAIN=$API_SUBDOMAIN

# Database configuration
DATABASE_URL=postgresql://cliproxyapi:${POSTGRES_PASSWORD}@postgres:5432/cliproxyapi
POSTGRES_PASSWORD=$POSTGRES_PASSWORD

# Dashboard secrets
JWT_SECRET=$JWT_SECRET
MANAGEMENT_API_KEY=$MANAGEMENT_API_KEY

# Management API URL
CLIPROXYAPI_MANAGEMENT_URL=http://cliproxyapi:8317/v0/management

# Installation directory (host path for volume mounts)
INSTALL_DIR=$INSTALL_DIR

# Timezone
TZ=UTC

# Logging
LOG_LEVEL=info

# Full URLs (for reference)
DASHBOARD_URL=https://${DASHBOARD_SUBDOMAIN}.${DOMAIN}
API_URL=https://${API_SUBDOMAIN}.${DOMAIN}
EOF
    
    chmod 600 "$ENV_FILE"
    log_success ".env file created"
fi

echo ""

# ============================================================================
# SYSTEMD SERVICE INSTALLATION
# ============================================================================

log_info "=== Systemd Service Installation ==="
echo ""

SERVICE_FILE="/etc/systemd/system/cliproxyapi-stack.service"

if [ -f "$SERVICE_FILE" ]; then
    log_warning "Systemd service already exists"
    read -p "Overwrite service file? [y/N]: " OVERWRITE_SERVICE
    if [[ ! "$OVERWRITE_SERVICE" =~ ^[Yy]$ ]]; then
        log_info "Keeping existing service file"
        SKIP_SERVICE=1
    else
        SKIP_SERVICE=0
    fi
else
    SKIP_SERVICE=0
fi

if [ $SKIP_SERVICE -eq 0 ]; then
    log_info "Creating systemd service..."
    
    if [ $EXTERNAL_PROXY -eq 1 ]; then
        COMPOSE_SERVICES="postgres cliproxyapi dashboard"
        COMPOSE_DESC="(without Caddy - using external reverse proxy)"
    else
        COMPOSE_SERVICES=""
        COMPOSE_DESC="(full stack)"
    fi
    
    cat > "$SERVICE_FILE" << EOF
[Unit]
Description=CLIProxyAPI Stack (Docker Compose)
Requires=docker.service
After=docker.service network-online.target
Wants=network-online.target

[Service]
Type=oneshot
RemainAfterExit=true
WorkingDirectory=$INSTALL_DIR/infrastructure
ExecStart=/usr/bin/docker compose up -d --wait $COMPOSE_SERVICES
ExecStop=/usr/bin/docker compose down
TimeoutStartSec=300
TimeoutStopSec=120

# Restart policy
Restart=on-failure
RestartSec=10s

# Security
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF
    
    # Reload systemd and enable service
    systemctl daemon-reload
    systemctl enable cliproxyapi-stack.service
    
    log_success "Systemd service installed and enabled"
fi

echo ""

# ============================================================================
# SCRIPTS INSTALLATION
# ============================================================================

log_info "=== Backup/Restore Scripts Setup ==="
echo ""

SCRIPTS_DIR="$INSTALL_DIR/scripts"

if [ ! -d "$SCRIPTS_DIR" ] || [ ! -f "$SCRIPTS_DIR/backup.sh" ]; then
    log_error "Scripts directory not found at $SCRIPTS_DIR"
    log_error "Ensure the repository was cloned correctly (scripts/ should exist)"
    exit 1
fi

chmod +x "$SCRIPTS_DIR/backup.sh"
chmod +x "$SCRIPTS_DIR/restore.sh"
chmod +x "$SCRIPTS_DIR/rotate-backups.sh"

log_success "Backup/restore scripts ready in $SCRIPTS_DIR"

echo ""

# ============================================================================
# CRON JOB SETUP (if backup interval selected)
# ============================================================================

if [ "$BACKUP_INTERVAL" != "none" ]; then
    log_info "=== Automated Backup Setup ==="
    echo ""
    
    # Determine cron schedule
    if [ "$BACKUP_INTERVAL" == "daily" ]; then
        CRON_SCHEDULE="0 2 * * *"  # 2 AM daily
        CRON_COMMENT="CLIProxyAPI daily backup"
    else
        CRON_SCHEDULE="0 2 * * 0"  # 2 AM Sunday
        CRON_COMMENT="CLIProxyAPI weekly backup"
    fi
    
    # Check if cron job already exists
    if crontab -l 2>/dev/null | grep -q "$SCRIPTS_DIR/backup.sh"; then
        log_warning "Backup cron job already exists"
    else
        log_info "Installing backup cron job ($BACKUP_INTERVAL)..."
        
        # Add cron job
        (crontab -l 2>/dev/null || true; echo "# $CRON_COMMENT"; echo "$CRON_SCHEDULE $SCRIPTS_DIR/backup.sh >> $INSTALL_DIR/backups/backup.log 2>&1 && $SCRIPTS_DIR/rotate-backups.sh $BACKUP_RETENTION >> $INSTALL_DIR/backups/backup.log 2>&1") | crontab -
        
        log_success "Backup cron job installed (runs $BACKUP_INTERVAL at 2 AM)"
    fi
    
    echo ""
fi

# ============================================================================
# EXTERNAL PROXY MODE SETUP
# ============================================================================

if [ $EXTERNAL_PROXY -eq 1 ]; then
    echo ""
    log_info "=== External Proxy Mode Setup ==="
    echo ""
    
    # Create docker-compose.override.yml to expose dashboard on localhost:3000
    OVERRIDE_FILE="$INSTALL_DIR/infrastructure/docker-compose.override.yml"
    
    log_info "Creating docker-compose.override.yml to expose dashboard on 127.0.0.1:3000..."
    
    cat > "$OVERRIDE_FILE" << 'COMPOSE_OVERRIDE'
services:
  dashboard:
    ports:
      - "127.0.0.1:3000:3000"
COMPOSE_OVERRIDE
    
    chmod 644 "$OVERRIDE_FILE"
    log_success "Override file created at $OVERRIDE_FILE"
    log_info "Dashboard will be accessible at http://127.0.0.1:3000 for your reverse proxy"
    echo ""
fi

# ============================================================================
# CADDY INTEGRATION (if external proxy mode)
# ============================================================================

if [ $EXTERNAL_PROXY -eq 1 ]; then
    echo ""
    log_info "=== Reverse Proxy Integration Setup ==="
    echo ""
    
    # Generate Caddy configuration snippet for host Caddy (localhost upstream)
    CADDY_SNIPPET_HOST=$(cat << 'CADDY_CONFIG'
# BEGIN CLIPROXYAPI-AUTO (Host Caddy - localhost upstream)
${DASHBOARD_SUBDOMAIN}.${DOMAIN} {
    reverse_proxy localhost:3000
}

${API_SUBDOMAIN}.${DOMAIN} {
    reverse_proxy localhost:8317
}
# END CLIPROXYAPI-AUTO
CADDY_CONFIG
)
    
    # Generate Caddy configuration snippet for Dockerized Caddy (service name upstream)
    CADDY_SNIPPET_DOCKER=$(cat << 'CADDY_DOCKER_CONFIG'
# BEGIN CLIPROXYAPI-AUTO (Docker Caddy - container upstream)
${DASHBOARD_SUBDOMAIN}.${DOMAIN} {
    reverse_proxy cliproxyapi-dashboard:3000
}

${API_SUBDOMAIN}.${DOMAIN} {
    reverse_proxy cliproxyapi:8317
}
# END CLIPROXYAPI-AUTO
CADDY_DOCKER_CONFIG
)
    
    # Replace template variables in both snippets
    CADDY_SNIPPET_HOST="${CADDY_SNIPPET_HOST//\$\{DASHBOARD_SUBDOMAIN\}/$DASHBOARD_SUBDOMAIN}"
    CADDY_SNIPPET_HOST="${CADDY_SNIPPET_HOST//\$\{API_SUBDOMAIN\}/$API_SUBDOMAIN}"
    CADDY_SNIPPET_HOST="${CADDY_SNIPPET_HOST//\$\{DOMAIN\}/$DOMAIN}"
    
    CADDY_SNIPPET_DOCKER="${CADDY_SNIPPET_DOCKER//\$\{DASHBOARD_SUBDOMAIN\}/$DASHBOARD_SUBDOMAIN}"
    CADDY_SNIPPET_DOCKER="${CADDY_SNIPPET_DOCKER//\$\{API_SUBDOMAIN\}/$API_SUBDOMAIN}"
    CADDY_SNIPPET_DOCKER="${CADDY_SNIPPET_DOCKER//\$\{DOMAIN\}/$DOMAIN}"
    
    log_info "Generated Caddy configurations for both host and Docker Caddy:"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "OPTION 1: Host Caddy (Caddy running on your system)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$CADDY_SNIPPET_HOST"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "OPTION 2: Docker Caddy (Caddy running in a container)"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "$CADDY_SNIPPET_DOCKER"
    echo ""
    echo "If using Docker Caddy, also connect it to the CLIProxyAPI frontend network:"
    echo "  ${YELLOW}docker network connect cliproxyapi_frontend <your-caddy-container-name>${NC}"
    echo ""
    
    read -p "Apply configuration to Caddy? [y/N]: " APPLY_CADDY
    if [[ "$APPLY_CADDY" =~ ^[Yy]$ ]]; then
        echo ""
        read -p "Is your Caddy running on the host system or in Docker? [host/docker]: " CADDY_MODE
        
        if [[ "$CADDY_MODE" =~ ^[Dd]ocker$ ]]; then
            SELECTED_SNIPPET="$CADDY_SNIPPET_DOCKER"
            log_info "Using Docker Caddy configuration (will use container names)"
        else
            SELECTED_SNIPPET="$CADDY_SNIPPET_HOST"
            log_info "Using host Caddy configuration (will use localhost)"
        fi
        
        read -p "Enter Caddyfile path [default: /etc/caddy/Caddyfile]: " CADDYFILE_PATH
        CADDYFILE_PATH="${CADDYFILE_PATH:-/etc/caddy/Caddyfile}"
        
        if [ ! -f "$CADDYFILE_PATH" ]; then
            log_error "Caddyfile not found at $CADDYFILE_PATH"
            log_warning "Skipping auto-apply. Please manually add the snippet above to your Caddyfile."
        else
            BACKUP_FILE="${CADDYFILE_PATH}.bak.$(date +%Y%m%d_%H%M%S)"
            log_info "Creating backup at $BACKUP_FILE"
            cp "$CADDYFILE_PATH" "$BACKUP_FILE"
            
            if grep -q "BEGIN CLIPROXYAPI-AUTO" "$CADDYFILE_PATH"; then
                log_warning "CLIProxyAPI configuration already exists in Caddyfile"
                log_info "Updating existing configuration..."
                
                awk '
                    BEGIN { in_section = 0; section_printed = 0 }
                    /# BEGIN CLIPROXYAPI-AUTO/ { in_section = 1; if (!section_printed) { print new_config; section_printed = 1 } next }
                    /# END CLIPROXYAPI-AUTO/ { in_section = 0; next }
                    !in_section { print }
                ' new_config="$SELECTED_SNIPPET" "$CADDYFILE_PATH" > "${CADDYFILE_PATH}.tmp"
            else
                {
                    cat "$CADDYFILE_PATH"
                    echo ""
                    echo "$SELECTED_SNIPPET"
                } > "${CADDYFILE_PATH}.tmp"
            fi
            
            if command -v caddy &> /dev/null; then
                log_info "Validating Caddy configuration..."
                if caddy validate --config "${CADDYFILE_PATH}.tmp" &> /dev/null; then
                    log_success "Configuration valid"
                    mv "${CADDYFILE_PATH}.tmp" "$CADDYFILE_PATH"
                    
                    read -p "Reload Caddy now? [y/N]: " RELOAD_CADDY
                    if [[ "$RELOAD_CADDY" =~ ^[Yy]$ ]]; then
                        if command -v systemctl &> /dev/null && systemctl is-active --quiet caddy; then
                            log_info "Reloading Caddy service..."
                            if systemctl reload caddy; then
                                log_success "Caddy reloaded successfully"
                            else
                                log_error "Failed to reload Caddy"
                                log_warning "Restoring backup from $BACKUP_FILE"
                                cp "$BACKUP_FILE" "$CADDYFILE_PATH"
                            fi
                        elif command -v docker &> /dev/null && docker ps --format '{{.Names}}' 2>/dev/null | grep -q caddy; then
                            log_info "Reloading Caddy container..."
                            read -p "Enter Caddy container name [default: caddy]: " CADDY_CONTAINER
                            CADDY_CONTAINER="${CADDY_CONTAINER:-caddy}"
                            
                            if docker exec "$CADDY_CONTAINER" caddy reload -c /etc/caddy/Caddyfile; then
                                log_success "Caddy container reloaded successfully"
                            else
                                log_error "Failed to reload Caddy container"
                                log_warning "Restoring backup from $BACKUP_FILE"
                                cp "$BACKUP_FILE" "$CADDYFILE_PATH"
                            fi
                        else
                            log_warning "Caddy not running. Please reload manually with: caddy reload -c $CADDYFILE_PATH"
                        fi
                    fi
                    
                    log_success "Caddy configuration updated"
                else
                    log_error "Caddy configuration validation failed"
                    log_warning "Restoring backup from $BACKUP_FILE"
                    cp "$BACKUP_FILE" "$CADDYFILE_PATH"
                    rm -f "${CADDYFILE_PATH}.tmp"
                fi
            else
                log_info "caddy command not found; skipping validation"
                log_warning "Please validate manually before reloading"
                mv "${CADDYFILE_PATH}.tmp" "$CADDYFILE_PATH"
            fi
        fi
    else
        log_info "Skipping auto-apply. Please manually add one of the configurations above to your Caddyfile."
        if [[ "$CADDY_MODE" =~ ^[Dd]ocker$ ]]; then
            log_info "Remember to connect Caddy to the frontend network:"
            echo "  ${YELLOW}docker network connect cliproxyapi_frontend <your-caddy-container-name>${NC}"
        fi
    fi
    
    echo ""
fi

# ============================================================================
# FINAL STEPS
# ============================================================================

log_info "=== Installation Complete ==="
echo ""

log_success "CLIProxyAPI Stack installation completed successfully!"
echo ""
log_info "Next steps:"
echo "  1. Start the stack:"
echo "     sudo systemctl start cliproxyapi-stack"
echo ""
echo "  2. Check status:"
echo "     sudo systemctl status cliproxyapi-stack"
echo ""
echo "  3. View logs:"
echo "     cd $INSTALL_DIR/infrastructure"
echo "     docker compose logs -f"
echo ""
if [ $EXTERNAL_PROXY -eq 1 ]; then
    echo "  4. Configure your reverse proxy:"
    echo "     - Dashboard routes to: localhost:3000"
    echo "     - API routes to: localhost:8317"
    echo "     - Ports 80/443 not bound by this stack"
    echo ""
    echo "  5. Access services (via your reverse proxy):"
    echo "     Dashboard: https://${DASHBOARD_SUBDOMAIN}.${DOMAIN}"
    echo "     API: https://${API_SUBDOMAIN}.${DOMAIN}"
    echo ""
else
    echo "  4. Access services (via integrated Caddy):"
    echo "     Dashboard: https://${DASHBOARD_SUBDOMAIN}.${DOMAIN}"
    echo "     API: https://${API_SUBDOMAIN}.${DOMAIN}"
    echo ""
fi
echo "  $([ $EXTERNAL_PROXY -eq 1 ] && echo 5 || echo 4). Create your admin account at the dashboard, then configure"
echo "     API keys and providers through the Configuration page."
echo ""
log_info "Backup commands:"
echo "  Manual backup:  $SCRIPTS_DIR/backup.sh"
echo "  Restore:        $SCRIPTS_DIR/restore.sh <backup_file>"
if [ "$BACKUP_INTERVAL" != "none" ]; then
    echo "  Automated:      $BACKUP_INTERVAL backups at 2 AM (keep last $BACKUP_RETENTION)"
fi
echo ""
log_warning "Secrets are stored in: $ENV_FILE (DO NOT commit to git)"
echo ""
