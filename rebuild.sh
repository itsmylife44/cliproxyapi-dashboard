#!/bin/bash
# Update the repo, pull latest images and restart CLIProxyAPI Dashboard services
# Usage: ./rebuild.sh [--dashboard-only]

set -e

cd "$(dirname "$0")"

echo "=== CLIProxyAPI Dashboard Update ==="
echo ""

# CLIProxyAPI rewrites config/config.yaml at runtime, so git no longer tracks it
# (config.example.yaml is the template). Checkouts from before that change still
# track it, and the pull that untracks it would abort or delete it. Park the live
# file during the pull: mv keeps the inode, so the running container is unaffected.
CONFIG=infrastructure/config/config.yaml
# A run killed mid-pull leaves the live config parked: put it back first.
if [ -f "$CONFIG.keep" ] && [ ! -f "$CONFIG" ]; then
    mv "$CONFIG.keep" "$CONFIG"
fi
# Only a checkout without .git skips the update; any other git failure stops here.
if [ -e .git ]; then
    echo "[0] Updating repository..."
    PARKED=0
    if git ls-files --error-unmatch "$CONFIG" > /dev/null 2>&1; then
        mv "$CONFIG" "$CONFIG.keep"
        PARKED=1
    fi
    PULL_OK=1
    git pull --ff-only || PULL_OK=0
    if [ $PARKED -eq 1 ]; then
        mv "$CONFIG.keep" "$CONFIG"
    fi
    if [ $PULL_OK -eq 0 ]; then
        echo "git pull failed; nothing was changed. Resolve it, then run ./rebuild.sh again."
        exit 1
    fi
    echo ""
fi
if [ ! -f "$CONFIG" ]; then
    cp infrastructure/config/config.example.yaml "$CONFIG"
fi

cd infrastructure

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
