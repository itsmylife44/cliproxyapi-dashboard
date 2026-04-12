#!/usr/bin/env bash
# Pull latest GHCR images and restart CLIProxyAPI Dashboard services
# Usage: ./rebuild.sh [--dashboard-only]

set -e

cd "$(dirname "$0")/infrastructure"

echo "=== CLIProxyAPI Dashboard Update ==="
echo ""

if [ "${1:-}" = "--dashboard-only" ]; then
    echo "[1/2] Pulling latest dashboard image..."
    docker compose pull dashboard

    echo ""
    echo "[2/2] Recreating dashboard container..."
    docker compose up -d --no-deps dashboard
else
    echo "[1/3] Pulling latest images..."
    docker compose pull

    echo ""
    echo "[2/3] Stopping and removing old containers..."
    docker compose down

    echo ""
    echo "[3/3] Starting fresh containers..."
    docker compose up -d
fi

echo ""
echo "=== Done! ==="
echo ""
echo "Checking container status..."
docker compose ps

echo ""
echo "View logs: cd infrastructure && docker compose logs -f"
