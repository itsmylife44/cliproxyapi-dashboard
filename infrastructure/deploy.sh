#!/bin/bash
# Dashboard Deploy Script
# Triggered by webhook from dashboard admin panel

set -e

# Configuration
REPO_DIR="/opt/cliproxyapi-dashboard"
INFRA_DIR="/opt/cliproxyapi-dashboard/infrastructure"
LOG_FILE="/tmp/dashboard-deploy.log"
STATUS_FILE="/tmp/dashboard-deploy-status.json"

# Parse arguments
NO_CACHE=""
if [ "$1" = "--no-cache" ]; then
    NO_CACHE="--no-cache"
fi

# Helper function to update status
update_status() {
    local step="$1"
    local status="$2"
    local message="$3"
    echo "{\"step\": \"$step\", \"status\": \"$status\", \"message\": \"$message\", \"timestamp\": \"$(date -Iseconds)\"}" > "$STATUS_FILE"
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$step] $message" >> "$LOG_FILE"
}

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

# Step 2: Docker Build
update_status "build" "running" "Building dashboard container${NO_CACHE:+ (no cache)}..."
cd "$INFRA_DIR"
if docker compose build $NO_CACHE dashboard >> "$LOG_FILE" 2>&1; then
    update_status "build" "completed" "Docker build successful"
else
    update_status "build" "failed" "Docker build failed"
    exit 1
fi

# Step 3: Docker Up
update_status "deploy" "running" "Starting new container..."
if docker compose up -d dashboard >> "$LOG_FILE" 2>&1; then
    update_status "deploy" "completed" "Container started successfully"
else
    update_status "deploy" "failed" "Failed to start container"
    exit 1
fi

# Step 4: Health Check
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
