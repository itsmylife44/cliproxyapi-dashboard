#!/bin/bash

# CLIProxyAPI Dashboard — Local Setup (macOS / Linux)
# Requires: Docker Desktop
# Usage: ./setup-local.sh [--down] [--reset]

set -euo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="${SCRIPT_DIR}/docker-compose.local.yml"
ENV_FILE="${SCRIPT_DIR}/.env"

show_usage() {
    echo "Usage: ./setup-local.sh [--down] [--reset]"
}

ACTION="up"
for arg in "$@"; do
    case "$arg" in
        --down)
            ACTION="down"
            ;;
        --reset)
            ACTION="reset"
            ;;
        -h|--help)
            show_usage
            exit 0
            ;;
        *)
            log_error "Unknown argument: $arg"
            show_usage
            exit 1
            ;;
    esac
done

ensure_openssl() {
    if ! command -v openssl &>/dev/null; then
        log_error "openssl not found. Please install OpenSSL and try again."
        exit 1
    fi
}

ensure_docker_running() {
    if ! command -v docker &>/dev/null; then
        log_error "Docker not found. Install Docker Desktop: https://www.docker.com/products/docker-desktop/"
        exit 1
    fi

    if ! docker info &>/dev/null 2>&1; then
        log_error "Docker is not running. Start Docker Desktop and try again."
        exit 1
    fi

    if ! docker compose version &>/dev/null 2>&1; then
        log_error "Docker Compose plugin not available. Update Docker Desktop and try again."
        exit 1
    fi
}

compose_down() {
    docker compose -f "$COMPOSE_FILE" down
}

compose_reset() {
    docker compose -f "$COMPOSE_FILE" down -v
    rm -f "$ENV_FILE" "${SCRIPT_DIR}/config.local.yaml"
}

generate_env_file() {
    if [ -f "$ENV_FILE" ]; then
        while true; do
            read -r -p ".env already exists. Overwrite? [y/N]: " OVERWRITE
            case "${OVERWRITE:-}" in
                [Yy])
                    break
                    ;;
                [Nn]|"")
                    log_info "Keeping existing .env"
                    return 0
                    ;;
                *)
                    log_warning "Please answer y or n."
                    ;;
            esac
        done
    fi

    ensure_openssl

    local jwt_secret management_api_key postgres_password
    jwt_secret="$(openssl rand -base64 32)"
    management_api_key="$(openssl rand -hex 32)"
    postgres_password="$(openssl rand -hex 32)"

    umask 077
    cat > "$ENV_FILE" <<EOF
JWT_SECRET=${jwt_secret}
MANAGEMENT_API_KEY=${management_api_key}
POSTGRES_PASSWORD=${postgres_password}
EOF

    log_success "Created .env in project root"
}

generate_config_yaml() {
    local config_file="${SCRIPT_DIR}/config.local.yaml"
    if [ -f "$config_file" ]; then
        return 0
    fi

    local api_key
    api_key="sk-local-$(openssl rand -hex 16)"

    cat > "$config_file" <<EOF
host: ""
port: 8317
auth-dir: "/root/.cli-proxy-api"
remote-management:
  allow-remote: true
  secret-key: "${MANAGEMENT_API_KEY:-$(grep MANAGEMENT_API_KEY "$ENV_FILE" 2>/dev/null | cut -d= -f2)}"
api-keys:
  - "${api_key}"
request-retry: 3
quota-exceeded:
  switch-project: true
  switch-preview-model: true
routing:
  strategy: "round-robin"
EOF

    log_success "Created config.local.yaml (API key: ${api_key})"
}

wait_for_health() {
    local timeout_seconds=300
    local start
    start="$(date +%s)"

    local containers=(
        "cliproxyapi-postgres"
        "cliproxyapi"
        "cliproxyapi-docker-proxy"
        "cliproxyapi-dashboard"
    )

    while true; do
        local now elapsed
        now="$(date +%s)"
        elapsed=$((now - start))
        if [ "$elapsed" -ge "$timeout_seconds" ]; then
            log_error "Timed out waiting for services to become healthy."
            log_info "Run: docker compose -f docker-compose.local.yml ps"
            log_info "Logs: docker compose -f docker-compose.local.yml logs -f"
            exit 1
        fi

        local all_healthy=1
        for c in "${containers[@]}"; do
            local status
            status="$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$c" 2>/dev/null || true)"
            if [ "$status" != "healthy" ]; then
                all_healthy=0
                break
            fi
        done

        if [ "$all_healthy" -eq 1 ]; then
            return 0
        fi

        sleep 3
    done
}

main() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        log_error "Missing docker-compose.local.yml in project root."
        exit 1
    fi

    ensure_docker_running

    case "$ACTION" in
        down)
            log_info "Stopping local stack..."
            compose_down
            log_success "Stopped"
            exit 0
            ;;
        reset)
            log_warning "Resetting local stack (removes volumes and deletes .env)..."
            compose_reset
            log_success "Reset complete"
            exit 0
            ;;
        up)
            ;;
    esac

    generate_env_file
    generate_config_yaml

    log_info "Starting local stack..."
    docker compose -f "$COMPOSE_FILE" up -d

    log_info "Waiting for services to become healthy..."
    wait_for_health

    log_success "CLIProxyAPI Dashboard is running!"
    echo "  Dashboard: http://localhost:3000"
    echo "  API:       http://localhost:11451"
    echo ""
    echo "  Stop:  ./setup-local.sh --down"
    echo "  Reset: ./setup-local.sh --reset"
}

main
