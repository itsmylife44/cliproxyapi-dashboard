#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

if [ $# -ne 1 ]; then
    echo "[ERROR] Usage: $0 <backup_file.tar.gz>"
    echo ""
    echo "Available backups:"
    ls -lh "$PROJECT_DIR/backups" 2>/dev/null || echo "  No backups found"
    exit 1
fi

BACKUP_FILE="$1"

if [ ! -f "$BACKUP_FILE" ]; then
    echo "[ERROR] Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "[WARNING] This will restore data from backup and overwrite current data!"
echo "[INFO] Backup file: $BACKUP_FILE"
read -p "Continue with restore? [y/N]: " CONFIRM
if [[ ! "$CONFIRM" =~ ^[Yy]$ ]]; then
    echo "[INFO] Restore cancelled"
    exit 0
fi

TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo "[INFO] Extracting backup..."
tar xzf "$BACKUP_FILE" -C "$TMP_DIR"

echo "[INFO] Stopping CLIProxyAPI stack..."
cd "$PROJECT_DIR/infrastructure"
docker compose down

echo "[INFO] Starting Postgres for restore..."
docker compose up -d postgres
sleep 10

echo "[INFO] Restoring database..."
docker compose exec -T postgres psql -U cliproxyapi -d cliproxyapi -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;" 2>/dev/null
docker compose exec -T postgres psql -U cliproxyapi -d cliproxyapi < "$TMP_DIR/database.sql"

echo "[INFO] Restoring config.yaml..."
cp "$TMP_DIR/config.yaml" config/config.yaml

echo "[INFO] Restoring auth directory..."
AUTH_VOLUME=$(docker volume ls --format '{{.Name}}' | grep cliproxyapi_auths | head -1)
if [ -z "$AUTH_VOLUME" ]; then
    echo "[WARN] Auth volume not found, skipping auth restore"
else
    docker run --rm \
        -v "$AUTH_VOLUME":/data \
        -v "$TMP_DIR":/backup \
        alpine sh -c "cd /data && rm -rf * && tar xzf /backup/auth-dir.tar.gz"
fi

echo "[INFO] Starting CLIProxyAPI stack..."
docker compose up -d --wait

echo "[SUCCESS] Restore completed successfully"
