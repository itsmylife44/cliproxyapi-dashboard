#!/bin/bash
#
# CLIProxyAPI Stack Installation Script
# Installs Docker, Docker Compose, optionally configures UFW, generates secrets, and sets up systemd service
#
# Usage: sudo ./install.sh [--dashboard-only]
#

set -euo pipefail

DASHBOARD_ONLY=0

show_usage() {
    cat << EOF
Usage: sudo ./install.sh [options]

Options:
  --dashboard-only   Install only the dashboard stack and connect it to an existing CLIProxyAPI
  -h, --help         Show this help message
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --dashboard-only)
            DASHBOARD_ONLY=1
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            show_usage
            exit 1
            ;;
    esac
    shift
done

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
    local container_names
    if [ "${DASHBOARD_ONLY:-0}" -eq 1 ]; then
        container_names=("cliproxyapi-dashboard" "cliproxyapi-postgres" "cliproxyapi-usage-collector" "cliproxyapi-backup-scheduler")
    elif [ $DASHBOARD_ONLY -eq 0 ]; then
        container_names=("cliproxyapi-caddy" "cliproxyapi" "cliproxyapi-dashboard" "cliproxyapi-docker-proxy" "cliproxyapi-postgres")
    fi
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

join_by_comma() {
    if [ "$#" -eq 0 ]; then
        echo "(none)"
        return
    fi

    local output=""
    local item
    for item in "$@"; do
        if [ -z "$output" ]; then
            output="$item"
        else
            output="$output, $item"
        fi
    done
    echo "$output"
}

port_in_range() {
    local port=$1
    [[ "$port" =~ ^[0-9]+$ ]] && [ "$port" -ge 1 ] && [ "$port" -le 65535 ]
}

normalize_port_list() {
    local raw=${1:-}
    local item start end
    local items=()
    local ports=()
    local IFS

    raw="${raw//[[:space:]]/}"
    [ -z "$raw" ] && return 0

    IFS=','
    read -ra items <<< "$raw"
    for item in "${items[@]}"; do
        [ -z "$item" ] && continue
        if [[ "$item" =~ ^[0-9]+$ ]]; then
            if ! port_in_range "$item"; then
                return 1
            fi
            ports+=("$item")
        elif [[ "$item" =~ ^([0-9]+):([0-9]+)$ ]]; then
            start="${BASH_REMATCH[1]}"
            end="${BASH_REMATCH[2]}"
            if ! port_in_range "$start" || ! port_in_range "$end" || [ "$start" -gt "$end" ]; then
                return 1
            fi
            ports+=("$start:$end")
        else
            return 1
        fi
    done

    printf '%s\n' "${ports[@]}" | awk 'NF && !seen[$0]++'
}

normalize_ssh_port_list() {
    local raw=${1:-}
    local normalized
    if ! normalized=$(normalize_port_list "$raw"); then
        return 1
    fi
    if echo "$normalized" | grep -q ':'; then
        return 1
    fi
    echo "$normalized"
}

detect_ssh_ports() {
    local candidates=()
    local port file

    if [ -n "${SSH_CONNECTION:-}" ]; then
        port=$(echo "$SSH_CONNECTION" | awk '{print $4}')
        if port_in_range "$port"; then
            candidates+=("$port")
        fi
    fi

    if command -v sshd &> /dev/null; then
        while read -r port; do
            if port_in_range "$port"; then
                candidates+=("$port")
            fi
        done < <(sshd -T 2>/dev/null | awk 'tolower($1) == "port" { print $2 }')
    fi

    for file in /etc/ssh/sshd_config /etc/ssh/sshd_config.d/*.conf; do
        [ -f "$file" ] || continue
        while read -r port; do
            if port_in_range "$port"; then
                candidates+=("$port")
            fi
        done < <(sed -E 's/[[:space:]]*#.*$//' "$file" | awk 'tolower($1) == "port" { print $2 }')
    done

    if [ ${#candidates[@]} -eq 0 ]; then
        candidates+=(22)
    fi

    printf '%s\n' "${candidates[@]}" | awk 'NF && !seen[$0]++'
}

ufw_rule_exists() {
    local port=$1
    local proto=$2
    ufw status 2>/dev/null | grep -Eq "(^|[[:space:]])${port}/${proto}([[:space:]]|$)"
}

add_ufw_allow_if_missing() {
    local port=$1
    local proto=$2
    local comment=$3

    if ufw_rule_exists "$port" "$proto"; then
        return 1
    fi

    ufw allow "$port/$proto" comment "$comment"
    log_info "Added UFW rule: $port/$proto"
    return 0
}

add_required_ufw_rules() {
    local port

    UFW_RULES_ADDED=0

    for port in "${REQUIRED_TCP_PORTS[@]}"; do
        if add_ufw_allow_if_missing "$port" tcp "CLIProxyAPI Dashboard required TCP"; then
            UFW_RULES_ADDED=$((UFW_RULES_ADDED + 1))
        fi
    done

    for port in "${REQUIRED_UDP_PORTS[@]}"; do
        if add_ufw_allow_if_missing "$port" udp "CLIProxyAPI Dashboard required UDP"; then
            UFW_RULES_ADDED=$((UFW_RULES_ADDED + 1))
        fi
    done

    return 0
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
    DISTRO_ID_LIKE="${ID_LIKE:-}"
    DISTRO_CODENAME="${UBUNTU_CODENAME:-${DEBIAN_CODENAME:-${VERSION_CODENAME:-}}}"
else
    log_error "Cannot detect Linux distribution (/etc/os-release not found)"
    exit 1
fi

# Resolve distro family: accept Ubuntu/Debian and their derivatives via ID_LIKE
# (e.g., Zorin, Linux Mint, Pop!_OS, elementary, Raspbian, LMDE)
DISTRO_FAMILY=""
case " $DISTRO_ID $DISTRO_ID_LIKE " in
    *\ ubuntu\ *)
        DISTRO_FAMILY="ubuntu"
        DOCKER_REPO_URL="https://download.docker.com/linux/ubuntu"
        # Codenames Docker publishes at https://download.docker.com/linux/ubuntu/dists/
        SUPPORTED_CODENAMES="trusty xenial bionic focal jammy noble"
        ;;
    *\ debian\ *)
        DISTRO_FAMILY="debian"
        DOCKER_REPO_URL="https://download.docker.com/linux/debian"
        # Codenames Docker publishes at https://download.docker.com/linux/debian/dists/
        SUPPORTED_CODENAMES="jessie stretch buster bullseye bookworm trixie"
        ;;
    *)
        log_error "Unsupported distribution: $DISTRO_ID (only Ubuntu/Debian and their derivatives are supported)"
        exit 1
        ;;
esac

# Validate codename - must be a suite Docker actually publishes for this family.
# Derivatives with rolling or custom codenames (e.g. Kali's kali-rolling) are
# rejected here because Docker does not ship a matching apt suite for them.
if [ -z "$DISTRO_CODENAME" ]; then
    log_error "Cannot determine $DISTRO_FAMILY codename for $DISTRO_ID (no UBUNTU_CODENAME/DEBIAN_CODENAME/VERSION_CODENAME in /etc/os-release)"
    exit 1
fi
case " $SUPPORTED_CODENAMES " in
    *\ "$DISTRO_CODENAME"\ *) ;;
    *)
        log_error "Unsupported $DISTRO_FAMILY codename '$DISTRO_CODENAME' for $DISTRO_ID: Docker publishes only [$SUPPORTED_CODENAMES]"
        log_error "If your distribution is based on a supported $DISTRO_FAMILY release, set UBUNTU_CODENAME or DEBIAN_CODENAME in /etc/os-release and re-run."
        exit 1
        ;;
esac

if [ "$DISTRO_ID" = "$DISTRO_FAMILY" ]; then
    log_info "Detected distribution: $DISTRO_ID ($DISTRO_CODENAME)"
else
    log_info "Detected distribution: $DISTRO_ID (using $DISTRO_FAMILY $DISTRO_CODENAME repositories)"
fi
log_info "Docker repository: $DOCKER_REPO_URL"

log_info "Starting CLIProxyAPI Stack installation..."
echo ""

# ============================================================================
# INTERACTIVE CONFIGURATION
# ============================================================================

log_info "=== Configuration ==="
echo ""

if [ $DASHBOARD_ONLY -eq 0 ]; then
    read -p "Install dashboard only and connect to an existing CLIProxyAPI? [y/N]: " DASHBOARD_ONLY_INPUT
    if [[ "$DASHBOARD_ONLY_INPUT" =~ ^[Yy]$ ]]; then
        DASHBOARD_ONLY=1
    fi
fi

if [ $DASHBOARD_ONLY -eq 1 ]; then
    log_info "Dashboard-only mode enabled: CLIProxyAPI, Caddy, Docker proxy, and Perplexity sidecar will not be installed."
    log_info "The dashboard will be exposed on 127.0.0.1:3000 for your reverse proxy."
fi
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

API_SUBDOMAIN="api"
if [ $DASHBOARD_ONLY -eq 0 ]; then
    # API subdomain
    read -p "Enter API subdomain [default: api]: " API_SUBDOMAIN
    API_SUBDOMAIN="${API_SUBDOMAIN:-api}"
fi

# External reverse proxy support
echo ""
if [ $DASHBOARD_ONLY -eq 1 ]; then
    EXTERNAL_PROXY=1
else
    read -p "Use existing reverse proxy/Caddy? [y/N]: " EXTERNAL_PROXY_INPUT
    if [[ "$EXTERNAL_PROXY_INPUT" =~ ^[Yy]$ ]]; then
        EXTERNAL_PROXY=1
    else
        EXTERNAL_PROXY=0
    fi
fi

if [ $DASHBOARD_ONLY -eq 1 ]; then
    echo ""
    while true; do
        read -p "Enter existing CLIProxyAPI management URL (remote, same-host, or non-Docker) [default: http://host.docker.internal:8317/v0/management]: " EXISTING_CLIPROXYAPI_MANAGEMENT_URL
        EXISTING_CLIPROXYAPI_MANAGEMENT_URL="${EXISTING_CLIPROXYAPI_MANAGEMENT_URL:-http://host.docker.internal:8317/v0/management}"
        EXISTING_CLIPROXYAPI_MANAGEMENT_URL="${EXISTING_CLIPROXYAPI_MANAGEMENT_URL%/}"
        if [[ "$EXISTING_CLIPROXYAPI_MANAGEMENT_URL" =~ ^https?://.+/v0/management$ ]]; then
            break
        fi
        log_error "Management URL must be an http(s) URL ending in /v0/management"
    done

    while true; do
        read -p "Enter existing CLIProxyAPI public API URL (for generated client configs): " EXISTING_API_URL
        EXISTING_API_URL="${EXISTING_API_URL%/}"
        if [[ "$EXISTING_API_URL" =~ ^https?://.+ ]]; then
            break
        fi
        log_error "API URL must start with http:// or https://"
    done

    while true; do
        read -s -p "Enter existing CLIProxyAPI management API key: " EXISTING_MANAGEMENT_API_KEY
        echo ""
        if [[ "$EXISTING_MANAGEMENT_API_KEY" =~ ^[^[:space:]]{16,}$ ]]; then
            break
        fi
        log_error "Management API key must be at least 16 characters and cannot contain whitespace"
    done
fi

# OAuth provider support
echo ""
if [ $DASHBOARD_ONLY -eq 1 ]; then
    log_info "OAuth callback ports are managed by your existing CLIProxyAPI installation."
    OAUTH_ENABLED=0
else
    read -p "Enable OAuth provider callbacks? [y/N]: " OAUTH_ENABLED
    if [[ "$OAUTH_ENABLED" =~ ^[Yy]$ ]]; then
        OAUTH_ENABLED=1
    else
        OAUTH_ENABLED=0
    fi
fi

# Perplexity Pro Sidecar support
echo ""
if [ $DASHBOARD_ONLY -eq 1 ]; then
    PERPLEXITY_ENABLED=0
else
    log_info "Perplexity Pro Sidecar provides an OpenAI-compatible API wrapper for Perplexity Pro subscriptions."
    log_info "If enabled, it runs as a separate container alongside the stack."
    read -p "Enable Perplexity Pro Sidecar? [y/N]: " PERPLEXITY_ENABLED_INPUT
    if [[ "$PERPLEXITY_ENABLED_INPUT" =~ ^[Yy]$ ]]; then
        PERPLEXITY_ENABLED=1
    else
        PERPLEXITY_ENABLED=0
    fi
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
log_info "  Mode: $([ $DASHBOARD_ONLY -eq 1 ] && echo 'dashboard-only' || echo 'full stack')"
log_info "  Domain: $DOMAIN"
log_info "  Dashboard: ${DASHBOARD_SUBDOMAIN}.${DOMAIN}"
if [ $DASHBOARD_ONLY -eq 1 ]; then
    log_info "  Existing CLIProxyAPI management URL: $EXISTING_CLIPROXYAPI_MANAGEMENT_URL"
    log_info "  Existing CLIProxyAPI public API URL: $EXISTING_API_URL"
else
    log_info "  API: ${API_SUBDOMAIN}.${DOMAIN}"
fi
log_info "  External reverse proxy: $([ $EXTERNAL_PROXY -eq 1 ] && echo 'enabled' || echo 'disabled')"
log_info "  OAuth callbacks: $([ $OAUTH_ENABLED -eq 1 ] && echo 'enabled' || echo 'disabled')"
log_info "  Perplexity Sidecar: $([ $PERPLEXITY_ENABLED -eq 1 ] && echo 'enabled' || echo 'disabled')"
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
REQUIRED_TCP_PORTS=()
REQUIRED_UDP_PORTS=()
if [ $EXTERNAL_PROXY -eq 0 ]; then
    REQUIRED_TCP_PORTS+=(80 443)
    REQUIRED_UDP_PORTS+=(443)
fi
if [ $OAUTH_ENABLED -eq 1 ]; then
    REQUIRED_TCP_PORTS+=(8085 1455 54545 51121 11451)
fi
REQUIRED_PORTS=("${REQUIRED_TCP_PORTS[@]}")

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

UFW_AVAILABLE=0
if command -v ufw &> /dev/null; then
    UFW_AVAILABLE=1
else
    log_warning "UFW is not installed."
    log_warning "The installer will not install or enable a firewall unless you explicitly opt in."
    read -p "Install and configure UFW rules now? [y/N]: " INSTALL_UFW_INPUT
    if [[ "$INSTALL_UFW_INPUT" =~ ^[Yy]$ ]]; then
        log_info "Installing UFW..."
        apt-get update
        apt-get install -y ufw
        UFW_AVAILABLE=1
    else
        log_info "Skipping UFW installation and firewall changes."
    fi
fi

if [ $UFW_AVAILABLE -eq 1 ]; then
    UFW_STATUS=$(ufw status | head -n 1)

    if [[ "$UFW_STATUS" == *"inactive"* ]]; then
        log_warning "UFW is currently inactive."
        log_warning "Enabling UFW on an existing server can block any service port that is not explicitly allowed."
        log_warning "The installer will not enable UFW unless you opt in and confirm the exact allowed ports."
        echo ""
        log_info "Ports required by this selected installation mode:"
        log_info "  TCP: $(join_by_comma "${REQUIRED_TCP_PORTS[@]}")"
        log_info "  UDP: $(join_by_comma "${REQUIRED_UDP_PORTS[@]}")"
        echo ""
        read -p "Configure and enable UFW now? [y/N]: " ENABLE_UFW_INPUT

        if [[ "$ENABLE_UFW_INPUT" =~ ^[Yy]$ ]]; then
            readarray -t DETECTED_SSH_PORTS < <(detect_ssh_ports)
            DETECTED_SSH_PORTS_TEXT=$(join_by_comma "${DETECTED_SSH_PORTS[@]}")

            while true; do
                read -p "SSH TCP port(s) to keep open [${DETECTED_SSH_PORTS_TEXT}]: " SSH_PORTS_INPUT
                SSH_PORTS_INPUT="${SSH_PORTS_INPUT:-$(IFS=','; echo "${DETECTED_SSH_PORTS[*]}")}"
                if SSH_PORTS_NORMALIZED=$(normalize_ssh_port_list "$SSH_PORTS_INPUT"); then
                    SSH_PORTS=()
                    if [ -n "$SSH_PORTS_NORMALIZED" ]; then
                        readarray -t SSH_PORTS <<< "$SSH_PORTS_NORMALIZED"
                    fi
                    if [ ${#SSH_PORTS[@]} -gt 0 ]; then
                        break
                    fi
                fi
                log_error "Enter one or more SSH TCP ports, comma-separated (for example: 22,2222)"
            done

            while true; do
                read -p "Additional existing TCP service ports/ranges to keep open (comma-separated, optional): " EXTRA_TCP_INPUT
                if EXTRA_TCP_NORMALIZED=$(normalize_port_list "$EXTRA_TCP_INPUT"); then
                    EXTRA_TCP_PORTS=()
                    if [ -n "$EXTRA_TCP_NORMALIZED" ]; then
                        readarray -t EXTRA_TCP_PORTS <<< "$EXTRA_TCP_NORMALIZED"
                    fi
                    break
                fi
                log_error "Invalid TCP port list. Use values like: 25,587,8000:8010"
            done

            while true; do
                read -p "Additional existing UDP service ports/ranges to keep open (comma-separated, optional): " EXTRA_UDP_INPUT
                if EXTRA_UDP_NORMALIZED=$(normalize_port_list "$EXTRA_UDP_INPUT"); then
                    EXTRA_UDP_PORTS=()
                    if [ -n "$EXTRA_UDP_NORMALIZED" ]; then
                        readarray -t EXTRA_UDP_PORTS <<< "$EXTRA_UDP_NORMALIZED"
                    fi
                    break
                fi
                log_error "Invalid UDP port list. Use values like: 53,123,6000:6010"
            done

            echo ""
            log_warning "UFW enable plan:"
            log_warning "  SSH TCP: $(join_by_comma "${SSH_PORTS[@]}")"
            log_warning "  Dashboard/CLIProxyAPI TCP: $(join_by_comma "${REQUIRED_TCP_PORTS[@]}")"
            log_warning "  Dashboard/CLIProxyAPI UDP: $(join_by_comma "${REQUIRED_UDP_PORTS[@]}")"
            log_warning "  Additional TCP: $(join_by_comma "${EXTRA_TCP_PORTS[@]}")"
            log_warning "  Additional UDP: $(join_by_comma "${EXTRA_UDP_PORTS[@]}")"
            log_warning "Any other inbound ports may become unreachable after UFW is enabled."
            read -p "Type ENABLE to apply these rules and enable UFW, or anything else to skip: " UFW_ENABLE_CONFIRM

            if [ "$UFW_ENABLE_CONFIRM" = "ENABLE" ]; then
                for port in "${SSH_PORTS[@]}"; do
                    if ! ufw_rule_exists "$port" tcp; then
                        ufw limit "$port/tcp" comment 'SSH access'
                        log_info "Added UFW SSH rule: $port/tcp"
                    fi
                done

                add_required_ufw_rules

                for port in "${EXTRA_TCP_PORTS[@]}"; do
                    add_ufw_allow_if_missing "$port" tcp "User-preserved existing TCP service" || true
                done

                for port in "${EXTRA_UDP_PORTS[@]}"; do
                    add_ufw_allow_if_missing "$port" udp "User-preserved existing UDP service" || true
                done

                ufw --force enable
                log_success "UFW configured and enabled"
            else
                log_warning "Skipping UFW enable. Configure firewall rules manually before exposing the service."
            fi
        else
            log_info "Skipping UFW enable. Existing network access will not be changed by the installer."
        fi
    else
        log_warning "UFW is already active. Existing rules and default policies will be preserved."
        if [ ${#REQUIRED_TCP_PORTS[@]} -eq 0 ] && [ ${#REQUIRED_UDP_PORTS[@]} -eq 0 ]; then
            log_info "This selected installation mode does not require opening public UFW ports."
        else
            log_info "Ports required by this selected installation mode:"
            log_info "  TCP: $(join_by_comma "${REQUIRED_TCP_PORTS[@]}")"
            log_info "  UDP: $(join_by_comma "${REQUIRED_UDP_PORTS[@]}")"
            read -p "Add missing CLIProxyAPI Dashboard UFW allow rules to the active firewall? [y/N]: " ADD_UFW_RULES_INPUT
            if [[ "$ADD_UFW_RULES_INPUT" =~ ^[Yy]$ ]]; then
                add_required_ufw_rules
                if [ "${UFW_RULES_ADDED:-0}" -eq 0 ]; then
                    log_success "All selected-mode UFW rules were already configured"
                else
                    ufw reload
                    log_success "UFW rules updated"
                fi
            else
                log_info "Skipping UFW rule changes. Configure required ports manually if needed."
            fi
        fi
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
POSTGRES_PASSWORD=$(openssl rand -hex 32)
COLLECTOR_API_KEY=$(openssl rand -hex 32)
BACKUP_SCHEDULER_KEY=$(openssl rand -hex 32)
PROVIDER_ENCRYPTION_KEY=$(openssl rand -hex 32)

if [ $DASHBOARD_ONLY -eq 1 ]; then
    MANAGEMENT_API_KEY="$EXISTING_MANAGEMENT_API_KEY"
fi

if [ $PERPLEXITY_ENABLED -eq 1 ]; then
    PERPLEXITY_SIDECAR_SECRET=$(openssl rand -hex 32)
fi

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

    DASHBOARD_PUBLIC_URL="https://${DASHBOARD_SUBDOMAIN}.${DOMAIN}"
    if [ $DASHBOARD_ONLY -eq 1 ]; then
        CLIPROXYAPI_MANAGEMENT_ENV="$EXISTING_CLIPROXYAPI_MANAGEMENT_URL"
        API_PUBLIC_URL="$EXISTING_API_URL"
        STACK_MODE="dashboard-only"
    else
        CLIPROXYAPI_MANAGEMENT_ENV="http://cliproxyapi:8317/v0/management"
        API_PUBLIC_URL="https://${API_SUBDOMAIN}.${DOMAIN}"
        STACK_MODE="full"
    fi

    cat > "$ENV_FILE" << EOF
# CLIProxyAPI Stack Environment Configuration
# Generated by install.sh on $(date)
STACK_MODE=$STACK_MODE

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
COLLECTOR_API_KEY=$COLLECTOR_API_KEY
BACKUP_SCHEDULER_KEY=$BACKUP_SCHEDULER_KEY
PROVIDER_ENCRYPTION_KEY=$PROVIDER_ENCRYPTION_KEY

# Management API URL
CLIPROXYAPI_MANAGEMENT_URL=$CLIPROXYAPI_MANAGEMENT_ENV

# Installation directory (host path for volume mounts)
INSTALL_DIR=$INSTALL_DIR

# Timezone
TZ=UTC

# Logging
LOG_LEVEL=info

# Full URLs (for reference)
DASHBOARD_URL=$DASHBOARD_PUBLIC_URL
API_URL=$API_PUBLIC_URL
EOF

    # Perplexity Sidecar (conditional)
    if [ $PERPLEXITY_ENABLED -eq 1 ]; then
        cat >> "$ENV_FILE" << EOF

# Perplexity Pro Sidecar
COMPOSE_PROFILES=perplexity
PERPLEXITY_SIDECAR_SECRET=$PERPLEXITY_SIDECAR_SECRET
EOF
    fi
    
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

    # When using an external reverse proxy, exclude Caddy from startup by naming
    # services explicitly. NOTE: when services are listed explicitly on the command
    # line Docker Compose does NOT auto-start profiled services from COMPOSE_PROFILES,
    # so perplexity-sidecar must also be listed here when it is enabled.
    #
    # We pass --project-directory with an absolute path so the command is portable
    # across working directories. Users who copy it from `systemctl cat` and run it
    # from a different cwd will not hit "no configuration file provided: not found"
    # (see https://github.com/itsmylife44/cliproxyapi-dashboard/issues/216).
    if [ $DASHBOARD_ONLY -eq 1 ]; then
        COMPOSE_BASE_CMD="/usr/bin/docker compose --project-directory $INSTALL_DIR/infrastructure -f $INSTALL_DIR/infrastructure/docker-compose.dashboard-only.yml"
        COMPOSE_START_CMD="$COMPOSE_BASE_CMD up -d --wait"
        COMPOSE_DESC="(dashboard only - existing CLIProxyAPI)"
    else
        COMPOSE_BASE_CMD="/usr/bin/docker compose --project-directory $INSTALL_DIR/infrastructure"
    fi
    if [ $DASHBOARD_ONLY -eq 0 ] && [ $EXTERNAL_PROXY -eq 1 ]; then
        COMPOSE_SERVICES="postgres cliproxyapi docker-proxy dashboard backup-scheduler"
        if [ $PERPLEXITY_ENABLED -eq 1 ]; then
            COMPOSE_SERVICES="$COMPOSE_SERVICES perplexity-sidecar"
        fi
        COMPOSE_START_CMD="$COMPOSE_BASE_CMD up -d --wait $COMPOSE_SERVICES"
        COMPOSE_DESC="(without Caddy - using external reverse proxy)"
    elif [ $DASHBOARD_ONLY -eq 0 ]; then
        # No explicit list — Compose starts everything; COMPOSE_PROFILES in .env
        # activates the perplexity profile when present.
        COMPOSE_START_CMD="$COMPOSE_BASE_CMD up -d --wait"
        COMPOSE_DESC="(full stack)"
    fi
    COMPOSE_STOP_CMD="$COMPOSE_BASE_CMD down"
    log_info "Systemd compose command: $COMPOSE_START_CMD $COMPOSE_DESC"

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
ExecStart=$COMPOSE_START_CMD
ExecStop=$COMPOSE_STOP_CMD
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
# USAGE COLLECTOR CRON JOB
# ============================================================================

log_info "=== Usage Collector Cron Job ==="
echo ""

log_info "Setting up usage data collection (every 5 minutes)..."
log_info "This prevents data loss when the proxy restarts."

if [ $EXTERNAL_PROXY -eq 1 ]; then
    COLLECTOR_URL="http://127.0.0.1:3000"
else
    COLLECTOR_URL="https://${DASHBOARD_SUBDOMAIN}.${DOMAIN}"
fi

COLLECTOR_CRON_SCHEDULE="*/5 * * * *"
COLLECTOR_CRON_CMD="curl -sf -X POST ${COLLECTOR_URL}/api/usage/collect -H 'Authorization: Bearer ${COLLECTOR_API_KEY}' -o /dev/null"

if crontab -l 2>/dev/null | grep -q "/api/usage/collect"; then
    log_warning "Usage collector cron job already exists"
else
    (crontab -l 2>/dev/null || true; echo "# CLIProxyAPI usage collector (every 5 minutes)"; echo "$COLLECTOR_CRON_SCHEDULE $COLLECTOR_CRON_CMD") | crontab -
    log_success "Usage collector cron job installed (every 5 minutes)"
fi

echo ""

# ============================================================================
# EXTERNAL PROXY MODE SETUP
# ============================================================================

if [ $EXTERNAL_PROXY -eq 1 ] && [ $DASHBOARD_ONLY -eq 0 ]; then
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
    
    if [ $DASHBOARD_ONLY -eq 1 ]; then
        # Generate Caddy configuration snippet for host Caddy (localhost upstream)
        CADDY_SNIPPET_HOST=$(cat << 'CADDY_CONFIG'
# BEGIN CLIPROXYAPI-AUTO (Dashboard only - host Caddy)
${DASHBOARD_SUBDOMAIN}.${DOMAIN} {
    reverse_proxy localhost:3000
}
# END CLIPROXYAPI-AUTO
CADDY_CONFIG
)

        # Generate Caddy configuration snippet for Dockerized Caddy (service name upstream)
        CADDY_SNIPPET_DOCKER=$(cat << 'CADDY_DOCKER_CONFIG'
# BEGIN CLIPROXYAPI-AUTO (Dashboard only - Docker Caddy)
${DASHBOARD_SUBDOMAIN}.${DOMAIN} {
    reverse_proxy cliproxyapi-dashboard:3000
}
# END CLIPROXYAPI-AUTO
CADDY_DOCKER_CONFIG
)
    else
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
    fi
    
    # Replace template variables in both snippets
    CADDY_SNIPPET_HOST="${CADDY_SNIPPET_HOST//\$\{DASHBOARD_SUBDOMAIN\}/$DASHBOARD_SUBDOMAIN}"
    CADDY_SNIPPET_HOST="${CADDY_SNIPPET_HOST//\$\{API_SUBDOMAIN\}/$API_SUBDOMAIN}"
    CADDY_SNIPPET_HOST="${CADDY_SNIPPET_HOST//\$\{DOMAIN\}/$DOMAIN}"
    
    CADDY_SNIPPET_DOCKER="${CADDY_SNIPPET_DOCKER//\$\{DASHBOARD_SUBDOMAIN\}/$DASHBOARD_SUBDOMAIN}"
    CADDY_SNIPPET_DOCKER="${CADDY_SNIPPET_DOCKER//\$\{API_SUBDOMAIN\}/$API_SUBDOMAIN}"
    CADDY_SNIPPET_DOCKER="${CADDY_SNIPPET_DOCKER//\$\{DOMAIN\}/$DOMAIN}"
    
    if [ $DASHBOARD_ONLY -eq 1 ]; then
        CADDY_DOCKER_NETWORK="cliproxyapi_dashboard"
    else
        CADDY_DOCKER_NETWORK="cliproxyapi_frontend"
    fi

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
    echo "If using Docker Caddy, also connect it to this stack's Docker network:"
    echo "  ${YELLOW}docker network connect $CADDY_DOCKER_NETWORK <your-caddy-container-name>${NC}"
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
        log_info "If you use Docker Caddy, connect it to this stack's Docker network:"
        echo "  ${YELLOW}docker network connect $CADDY_DOCKER_NETWORK <your-caddy-container-name>${NC}"
    fi
    
    echo ""
fi

# ============================================================================
# WEBHOOK DEPLOY SERVICE (Optional)
# ============================================================================

echo ""
log_info "=== Dashboard Deploy Webhook (Optional) ==="
echo ""
log_info "The webhook service enables one-click dashboard updates from the admin panel."
log_info "It runs a lightweight HTTP server that triggers git pull + image pull + restart."
echo ""

read -p "Install webhook deploy service? [y/N]: " INSTALL_WEBHOOK
if [[ "$INSTALL_WEBHOOK" =~ ^[Yy]$ ]]; then
    log_info "Installing webhook..."
    
    # Install webhook binary
    if command -v webhook &> /dev/null; then
        log_success "webhook already installed"
    else
        apt-get install -y webhook
        log_success "webhook installed"
    fi
    
    # Generate deploy secret
    DEPLOY_SECRET=$(openssl rand -hex 32)
    
    # Create webhook config directory
    mkdir -p /etc/webhook
    
    # Copy and configure webhook.yaml
    log_info "Configuring webhook..."
    sed "s/{{DEPLOY_SECRET}}/$DEPLOY_SECRET/g" "$INSTALL_DIR/infrastructure/webhook.yaml" > /etc/webhook/hooks.yaml
    chmod 600 /etc/webhook/hooks.yaml
    
    # Make deploy script executable
    chmod +x "$INSTALL_DIR/infrastructure/deploy.sh"
    
    # Create systemd service for webhook
    cat > /etc/systemd/system/webhook-deploy.service << EOF
[Unit]
Description=Webhook Deploy Service for CLIProxyAPI Dashboard
After=network.target

[Service]
Type=simple
ExecStart=/usr/bin/webhook -hooks /etc/webhook/hooks.yaml -port 9000 -verbose
Restart=on-failure
RestartSec=5
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF
    
    # Enable and start webhook service
    systemctl daemon-reload
    systemctl enable webhook-deploy.service
    systemctl start webhook-deploy.service
    
    log_success "Webhook service installed and started on port 9000"
    
    # Add webhook env vars to .env file
    log_info "Adding webhook configuration to .env..."
    cat >> "$ENV_FILE" << EOF

# Webhook Deploy Service
WEBHOOK_HOST=http://host.docker.internal:9000
DEPLOY_SECRET=$DEPLOY_SECRET
EOF
    
    OVERRIDE_FILE="$INSTALL_DIR/infrastructure/docker-compose.override.yml"
    if [ -f "$OVERRIDE_FILE" ]; then
        # Check if extra_hosts already configured
        if grep -q "extra_hosts" "$OVERRIDE_FILE"; then
            log_info "extra_hosts already configured in override file"
        else
            log_warning "docker-compose.override.yml exists but doesn't have extra_hosts."
            log_warning "Please manually add the following under 'services: dashboard:':"
            log_warning "    extra_hosts:"
            log_warning "      - \"host.docker.internal:host-gateway\""
        fi
    else
        # Create new override file
        cat > "$OVERRIDE_FILE" << 'OVERRIDE_NEW'
services:
  dashboard:
    extra_hosts:
      - "host.docker.internal:host-gateway"
OVERRIDE_NEW
        log_success "Created docker-compose.override.yml with host networking"
    fi
    
    log_success "Webhook deploy service configured"
    echo ""
    log_info "Deploy secret saved to $ENV_FILE"
    log_info "You can now use 'Quick Update' and 'Full Rebuild' buttons in Dashboard Settings"
    
    WEBHOOK_INSTALLED=1
else
    log_info "Skipping webhook installation"
    log_info "You can install it later by following: infrastructure/WEBHOOK_SETUP.md"
    WEBHOOK_INSTALLED=0
fi

echo ""

# ============================================================================
# FINAL STEPS
# ============================================================================

log_info "=== Installation Complete ==="
echo ""

if [ $DASHBOARD_ONLY -eq 1 ]; then
    log_success "CLIProxyAPI Dashboard-only installation completed successfully!"
else
    log_success "CLIProxyAPI Stack installation completed successfully!"
fi
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
if [ $DASHBOARD_ONLY -eq 1 ]; then
    echo "     docker compose -f docker-compose.dashboard-only.yml logs -f"
else
    echo "     docker compose logs -f"
fi
echo ""
if [ $DASHBOARD_ONLY -eq 1 ]; then
    echo "  4. Configure your reverse proxy:"
    echo "     - Dashboard routes to: localhost:3000"
    echo "     - CLIProxyAPI remains your existing service: $EXISTING_API_URL"
    echo "     - Ports 80/443 are not bound by the dashboard-only stack"
    echo ""
    echo "  5. Access services:"
    echo "     Dashboard: https://${DASHBOARD_SUBDOMAIN}.${DOMAIN}"
    echo "     Existing API: $EXISTING_API_URL"
    echo ""
elif [ $EXTERNAL_PROXY -eq 1 ]; then
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
echo "  $([ $EXTERNAL_PROXY -eq 1 ] && echo 6 || echo 5). Create your admin account at the dashboard, then configure"
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
