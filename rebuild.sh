#!/bin/bash
# Rebuild and restart all CLIProxyAPI Dashboard services
# Usage: ./rebuild.sh [--no-cache]

set -e

cd "$(dirname "$0")/infrastructure"

echo "=== CLIProxyAPI Dashboard Rebuild ==="
echo ""

# Check for --no-cache flag
if [ "$1" = "--no-cache" ]; then
    echo "[1/3] Building all images (no cache)..."
    docker compose build --no-cache
else
    echo "[1/3] Building all images..."
    docker compose build
fi

echo ""
echo "[2/3] Stopping and removing old containers..."
docker compose down

echo ""
echo "[3/3] Starting fresh containers..."
docker compose up -d

echo ""
echo "=== Done! ==="
echo ""
echo "Checking container status..."
docker compose ps

echo ""
echo "View logs: cd infrastructure && docker compose logs -f"
