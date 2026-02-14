#!/bin/bash
# Pull latest GHCR images and restart CLIProxyAPI Dashboard services
# Usage: ./rebuild.sh

set -e

cd "$(dirname "$0")/infrastructure"

echo "=== CLIProxyAPI Dashboard Update ==="
echo ""

echo "[1/3] Pulling latest images..."
docker compose pull dashboard

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
