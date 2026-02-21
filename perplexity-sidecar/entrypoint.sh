#!/bin/sh
set -e

echo "[entrypoint] Checking for perplexity-webui-scraper updates..."
pip install --no-cache-dir --quiet --upgrade perplexity-webui-scraper 2>&1 | grep -v "already satisfied" || true

INSTALLED=$(pip show perplexity-webui-scraper 2>/dev/null | grep "^Version:" | awk '{print $2}')
echo "[entrypoint] perplexity-webui-scraper version: ${INSTALLED}"

exec python app.py
