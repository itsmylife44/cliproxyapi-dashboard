#!/bin/bash
# Dashboard Deploy Script
# Triggered by webhook from dashboard admin panel

# Configuration
REPO_DIR="/opt/cliproxyapi-dashboard"
INFRA_DIR="/opt/cliproxyapi-dashboard/infrastructure"
LOG_DIR="/var/log/cliproxyapi"
LOG_FILE="${LOG_DIR}/dashboard-deploy.log"
STATUS_FILE="${LOG_DIR}/dashboard-deploy-status.json"
LOCK_FILE="${LOG_DIR}/deploy.lock"

# Ensure log directory exists with proper permissions
mkdir -p "$LOG_DIR"
chmod 755 "$LOG_DIR"

# Parse arguments
FOREGROUND=false
for arg in "$@"; do
    if [ "$arg" = "--foreground" ]; then
        FOREGROUND=true
    fi
done

# Helper function to update status
update_status() {
    local step="$1"
    local status="$2"
    local message="$3"
    echo "{\"step\": \"$step\", \"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -Iseconds)\"}" > "$STATUS_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$step] $message" >> "$LOG_FILE"
}

# Skip lock check if running in foreground (child process)
# The parent already verified no deployment is running before forking
if [ "$FOREGROUND" = false ]; then
    # Check if already running (with stale lock detection)
    if [ -f "$LOCK_FILE" ]; then
        # Check if lock file is older than 10 minutes (stale)
        LOCK_AGE=$(($(date +%s) - $(stat -c %Y "$LOCK_FILE" 2>/dev/null || echo 0)))
        if [ "$LOCK_AGE" -gt 600 ]; then
            echo "Removing stale lock file (age: ${LOCK_AGE}s)" >> "$LOG_FILE"
            rm -f "$LOCK_FILE"
        else
            PID=$(cat "$LOCK_FILE" 2>/dev/null)
            if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
                echo "Deployment already in progress (PID: $PID)" >> "$LOG_FILE"
                echo "Deployment already in progress (PID: $PID)"
                exit 0
            fi
            # Process not running but lock exists - remove stale lock
            rm -f "$LOCK_FILE"
        fi
    fi
fi

# Fork to background and return immediately (only parent forks)
if [ "$FOREGROUND" = false ]; then
    # Create lock file BEFORE forking
    echo "pending" > "$LOCK_FILE"
    nohup "$0" "$@" --foreground >> "$LOG_FILE" 2>&1 &
    CHILD_PID=$!
    echo "$CHILD_PID" > "$LOCK_FILE"
    echo "Deployment started in background (PID: $CHILD_PID)"
    exit 0
fi

# Running in foreground (forked process)
set -e
trap 'rm -f "$LOCK_FILE"' EXIT

# Clear previous log
echo "" > "$LOG_FILE"
update_status "init" "running" "Starting deployment..."

# Step 1: Git Pull
update_status "git" "running" "Pulling latest changes from git..."
cd "$REPO_DIR"
if git pull >> "$LOG_FILE" 2>&1; then
    update_status "git" "completed" "Git pull successful"
else
    update_status "git" "failed" "Git pull failed"
    exit 1
fi

# Step 2: Pull latest image
update_status "pull" "running" "Pulling latest dashboard image from GHCR..."
cd "$INFRA_DIR"
if docker compose pull dashboard >> "$LOG_FILE" 2>&1; then
    update_status "pull" "completed" "Image pull successful"
else
    update_status "pull" "failed" "Image pull failed"
    exit 1
fi

# Step 3: Ensure docker-proxy is running
update_status "proxy" "running" "Ensuring Docker socket proxy is running..."
if docker compose up -d docker-proxy >> "$LOG_FILE" 2>&1; then
    update_status "proxy" "completed" "Docker socket proxy is running"
else
    update_status "proxy" "failed" "Failed to start Docker socket proxy"
    exit 1
fi

# Step 4: Docker Up
update_status "deploy" "running" "Starting new dashboard container..."
if docker compose up -d --no-deps dashboard >> "$LOG_FILE" 2>&1; then
    update_status "deploy" "completed" "Container started successfully"
else
    update_status "deploy" "failed" "Failed to start container"
    exit 1
fi

# Step 5: Health Check
update_status "health" "running" "Waiting for health check..."
sleep 5

# Check if container is healthy
HEALTH=$(docker inspect --format='{{.State.Health.Status}}' cliproxyapi-dashboard 2>/dev/null || echo "unknown")
if [ "$HEALTH" = "healthy" ]; then
    update_status "done" "completed" "Deployment successful! Dashboard is healthy."
else
    # Wait a bit more and check again
    sleep 10
    HEALTH=$(docker inspect --format='{{.State.Health.Status}}' cliproxyapi-dashboard 2>/dev/null || echo "unknown")
    if [ "$HEALTH" = "healthy" ]; then
        update_status "done" "completed" "Deployment successful! Dashboard is healthy."
    else
        update_status "done" "completed" "Deployment finished. Health status: $HEALTH"
    fi
fi

echo "Deployment completed at $(date)" >> "$LOG_FILE"
