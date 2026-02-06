#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_DIR/backups"

KEEP_COUNT=${1:-4}

if [ ! -d "$BACKUP_DIR" ]; then
    echo "[INFO] No backups directory found"
    exit 0
fi

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "cliproxyapi_backup_*.tar.gz" | wc -l)

if [ "$BACKUP_COUNT" -le "$KEEP_COUNT" ]; then
    echo "[INFO] Current backups ($BACKUP_COUNT) within retention limit ($KEEP_COUNT)"
    exit 0
fi

echo "[INFO] Rotating backups (keep $KEEP_COUNT, remove $((BACKUP_COUNT - KEEP_COUNT)))"

ls -1t "$BACKUP_DIR"/cliproxyapi_backup_*.tar.gz 2>/dev/null | \
    tail -n +$((KEEP_COUNT + 1)) | \
    while read -r file; do
        echo "[INFO] Removing old backup: $(basename "$file")"
        rm -f "$file"
    done

echo "[SUCCESS] Backup rotation completed"
