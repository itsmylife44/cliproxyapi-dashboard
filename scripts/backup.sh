#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="cliproxyapi_backup_${TIMESTAMP}.tar.gz"

mkdir -p "$BACKUP_DIR"

echo "[INFO] Starting backup at $(date)"
echo "[INFO] Backup location: $BACKUP_DIR/$BACKUP_FILE"

TMP_DIR=$(mktemp -d)
trap "rm -rf $TMP_DIR" EXIT

echo "[INFO] Backing up Postgres database..."
cd "$PROJECT_DIR/infrastructure"
docker compose exec -T postgres pg_dump -U cliproxyapi -d cliproxyapi > "$TMP_DIR/database.sql"

echo "[INFO] Backing up config.yaml..."
cp config/config.yaml "$TMP_DIR/config.yaml"

echo "[INFO] Backing up auth directory..."
AUTH_VOLUME=$(docker volume ls --format '{{.Name}}' | grep cliproxyapi_auths | head -1)
if [ -z "$AUTH_VOLUME" ]; then
    echo "[WARN] Auth volume not found, skipping auth backup"
else
    docker run --rm \
        -v "$AUTH_VOLUME":/data:ro \
        -v "$TMP_DIR":/backup \
        alpine tar czf /backup/auth-dir.tar.gz -C /data .
fi

echo "[INFO] Creating backup archive..."
cd "$TMP_DIR"
tar czf "$BACKUP_DIR/$BACKUP_FILE" database.sql config.yaml auth-dir.tar.gz

echo "[SUCCESS] Backup completed: $BACKUP_DIR/$BACKUP_FILE"
echo "[INFO] Backup size: $(du -h "$BACKUP_DIR/$BACKUP_FILE" | cut -f1)"
