#!/bin/bash
# Pull latest GHCR images and restart CLIProxyAPI Dashboard services
# Usage: ./rebuild.sh [--dashboard-only]

set -e

cd "$(dirname "$0")/infrastructure"

# Installs keep their own config/config.yaml (CLIProxyAPI rewrites it), so the
# template's usage-queue retention never reaches them. Upstream defaults to 60 s,
# which drops usage records before the 5-minute collector runs. Set 3600 when the
# key is missing or still at the default 60; any other value is left alone.
# Called while the proxy is stopped: one in-place write (keeps the bind-mounted inode).
ensure_usage_queue_retention() {
    local file="$1" key="redis-usage-queue-retention-seconds" tmp
    [ -f "$file" ] || return 0
    tmp="$(mktemp)"
    if grep -qE "^[[:space:]]*${key}:" "$file"; then
        sed -E "s/^([[:space:]]*${key}:)[[:space:]]*(60)?[[:space:]]*$/\1 3600/" "$file" > "$tmp"
    else
        # Root key also works in v8-layout files; upstream nests it on its next write.
        { cat "$file"; [ -z "$(tail -c1 "$file")" ] || echo; echo "${key}: 3600"; } > "$tmp"
    fi
    if ! cmp -s "$file" "$tmp"; then
        cat "$tmp" > "$file"
        echo "Set ${key}: 3600 in $file"
    fi
    rm -f "$tmp"
}

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
    ensure_usage_queue_retention config/config.yaml

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
