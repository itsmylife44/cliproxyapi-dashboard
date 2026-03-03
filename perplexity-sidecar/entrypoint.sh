#!/bin/sh
set -e

echo "[entrypoint] Starting perplexity-sidecar..."
INSTALLED=$(pip show perplexity-webui-scraper 2>/dev/null | grep "^Version:" | awk '{print $2}')
echo "[entrypoint] perplexity-webui-scraper version: ${INSTALLED}"

exec python app.py
