#!/bin/bash
# Local macOS Docker-based development script
# Replaces SSH tunnel approach with local Docker containers
# Usage: ./dev-local.sh [--down|--reset]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
COMPOSE_FILE="$SCRIPT_DIR/docker-compose.dev.yml"
ENV_FILE="$SCRIPT_DIR/.env.development"
ENV_LOCAL_FILE="$SCRIPT_DIR/.env.local"

# Container names
POSTGRES_CONTAINER="cliproxyapi-dev-postgres"
API_CONTAINER="cliproxyapi-dev-api"

# Function to print colored status messages
log_info() {
    echo -e "${BLUE}ℹ${NC}  $1"
}

log_success() {
    echo -e "${GREEN}✓${NC}  $1"
}

log_error() {
    echo -e "${RED}✗${NC}  $1"
}

log_warning() {
    echo -e "${YELLOW}⚠${NC}  $1"
}

# Function to check if Docker daemon is running
check_docker() {
    if ! docker info >/dev/null 2>&1; then
        log_error "Docker daemon is not running"
        echo ""
        echo "Please start Docker Desktop:"
        echo "  1. Open Docker Desktop application"
        echo "  2. Wait for Docker to start (whale icon in menu bar)"
        echo "  3. Run this script again"
        exit 1
    fi
    log_success "Docker daemon is running"
}

# Function to start Docker containers
start_containers() {
    log_info "Starting Docker containers..."
    
    # Check if containers are already running
    if docker ps --format '{{.Names}}' | grep -q "^${POSTGRES_CONTAINER}$" && \
       docker ps --format '{{.Names}}' | grep -q "^${API_CONTAINER}$"; then
        log_warning "Containers already running, reusing existing containers"
        return 0
    fi
    
    # Start containers
    docker compose -f "$COMPOSE_FILE" up -d
    log_success "Containers started"
}

# Function to wait for PostgreSQL to be healthy
wait_for_postgres() {
    log_info "Waiting for PostgreSQL to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if docker exec "$POSTGRES_CONTAINER" pg_isready -U cliproxyapi -d cliproxyapi >/dev/null 2>&1; then
            log_success "PostgreSQL is ready"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 1
        echo -n "."
    done
    
    echo ""
    log_error "PostgreSQL failed to become ready after ${max_attempts} seconds"
    exit 1
}

# Function to wait for CLIProxyAPI to be healthy
wait_for_cliproxyapi() {
    log_info "Waiting for CLIProxyAPI to be ready..."
    
    local max_attempts=30
    local attempt=0
    
    while [ $attempt -lt $max_attempts ]; do
        if curl -s -f http://localhost:28317/ >/dev/null 2>&1; then
            log_success "CLIProxyAPI is ready"
            return 0
        fi
        
        attempt=$((attempt + 1))
        sleep 1
        echo -n "."
    done
    
    echo ""
    log_error "CLIProxyAPI failed to become ready after ${max_attempts} seconds"
    exit 1
}

# Function to run Prisma migrations
run_migrations() {
    log_info "Running Prisma migrations..."
    
    # Export DATABASE_URL for Prisma
    export DATABASE_URL="postgresql://cliproxyapi:devpassword@localhost:5432/cliproxyapi"
    
    # Bootstrap: push full schema to ensure all tables exist, then mark migrations applied.
    # This is needed because the project started with db push before adopting migrations.
    if ! docker exec "$POSTGRES_CONTAINER" psql -U cliproxyapi -d cliproxyapi -tAc "SELECT 1 FROM _prisma_migrations LIMIT 1" >/dev/null 2>&1; then
        log_info "Fresh database detected, bootstrapping schema via prisma db push..."
        npx prisma db push --accept-data-loss >/dev/null 2>&1
        npx prisma migrate resolve --applied 20250206_add_model_preferences >/dev/null 2>&1 || true
        npx prisma migrate resolve --applied 20260206_add_sync_tokens >/dev/null 2>&1 || true
        npx prisma migrate resolve --applied 20260207_add_user_api_keys_and_admin >/dev/null 2>&1 || true
        npx prisma migrate resolve --applied 20260207_add_config_sharing >/dev/null 2>&1 || true
        npx prisma migrate resolve --applied 20260207_add_provider_ownership_models >/dev/null 2>&1 || true
         npx prisma migrate resolve --applied 20260208_add_name_to_provider_key_ownership >/dev/null 2>&1 || true
         npx prisma migrate resolve --applied 20260208_add_custom_providers >/dev/null 2>&1 || true
         npx prisma migrate resolve --applied 20260208_add_sync_token_hash_index >/dev/null 2>&1 || true
         npx prisma migrate resolve --applied 20260208_add_provider_key_composite_index >/dev/null 2>&1 || true
         npx prisma migrate resolve --applied 20260209_add_audit_logs >/dev/null 2>&1 || true
         npx prisma migrate resolve --applied 20260210_add_user_session_version >/dev/null 2>&1 || true
       fi
    
    if npx prisma migrate deploy; then
        log_success "Migrations applied"
    else
        log_error "Failed to run migrations"
        exit 1
    fi
}

# Function to generate Prisma client
generate_prisma() {
    log_info "Generating Prisma client..."
    
    if npx prisma generate; then
        log_success "Prisma client generated"
    else
        log_error "Failed to generate Prisma client"
        exit 1
    fi
}

# Function to write .env.local file
write_env_local() {
    log_info "Writing .env.local..."
    
    cp "$ENV_FILE" "$ENV_LOCAL_FILE"
    log_success ".env.local updated"
}

# Function to start Next.js dev server
start_nextjs() {
    log_info "Starting Next.js development server..."
    echo ""
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${GREEN}  Dashboard:  http://localhost:3000${NC}"
    echo -e "${BLUE}  PostgreSQL: localhost:5432${NC}"
    echo -e "${BLUE}  API:        http://localhost:28317${NC}"
    echo -e "${GREEN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo -e "${YELLOW}Press Ctrl+C to stop${NC}"
    echo ""
    
    npm run dev
}

# Function to stop containers
stop_containers() {
    log_info "Stopping containers..."
    docker compose -f "$COMPOSE_FILE" down
    log_success "Containers stopped"
}

# Function to reset (stop + remove volumes)
reset_containers() {
    log_info "Resetting development environment (this will delete all data)..."
    docker compose -f "$COMPOSE_FILE" down -v
    log_success "Containers and volumes removed"
}

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    log_info "Shutting down..."
    log_info "Containers will keep running (use --down to stop them)"
    exit 0
}

# Trap Ctrl+C and SIGTERM
trap cleanup INT TERM

# Main script logic
main() {
    # Handle flags
    case "${1:-}" in
        --down)
            check_docker
            stop_containers
            exit 0
            ;;
        --reset)
            check_docker
            reset_containers
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [--down|--reset]"
            echo ""
            echo "Options:"
            echo "  (none)    Start development environment"
            echo "  --down    Stop and remove containers"
            echo "  --reset   Stop containers and remove volumes (fresh start)"
            echo "  --help    Show this help message"
            exit 0
            ;;
        "")
            # No flag, proceed with normal startup
            ;;
        *)
            log_error "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
    
    cd "$SCRIPT_DIR"
    
    # Startup sequence
    check_docker
    start_containers
    wait_for_postgres
    wait_for_cliproxyapi
    run_migrations
    generate_prisma
    write_env_local
    start_nextjs
}

# Run main
main "$@"
