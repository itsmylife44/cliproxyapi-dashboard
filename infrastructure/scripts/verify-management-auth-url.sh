#!/usr/bin/env bash
# Hit CLIProxyAPI management OAuth URL directly (bypasses the Next.js dashboard).
# Expect HTTP 200 and a JSON body with an auth URL when config is valid.
#
# Production (typical): run on the server over SSH — 8317 is bound to 127.0.0.1 only.
#   ssh prod
#   cd /opt/cliproxyapi-dashboard/infrastructure   # or your INSTALL_DIR layout
#   set -a && source .env && set +a
#   ./scripts/verify-management-auth-url.sh
# Or from the cliproxyapi container (no host curl needed):
#   docker compose -f docker-compose.yml exec cliproxyapi wget -qO- \
#     --header="Authorization: Bearer $MANAGEMENT_API_KEY" \
#     "http://127.0.0.1:8317/v0/management/anthropic-auth-url?is_webui=true"
#
# Override base URL if management listens elsewhere:
#   CLIPROXY_MANAGEMENT_BASE=http://cliproxyapi:8317/v0/management ./verify-management-auth-url.sh

set -euo pipefail

BASE="${CLIPROXY_MANAGEMENT_BASE:-http://127.0.0.1:8317/v0/management}"
KEY="${MANAGEMENT_API_KEY:-}"

if [[ -z "$KEY" ]]; then
  echo "error: set MANAGEMENT_API_KEY (same value as MANAGEMENT_PASSWORD on cliproxyapi)" >&2
  exit 1
fi

URL="${BASE%/}/anthropic-auth-url?is_webui=true"
echo "GET $URL" >&2
tmp="$(mktemp)"
trap 'rm -f "$tmp"' EXIT
code="$(curl -sS -o "$tmp" -w "%{http_code}" \
  -H "Authorization: Bearer ${KEY}" \
  "$URL")"
echo "HTTP $code" >&2
cat "$tmp"
echo "" >&2
if [[ "$code" != "200" ]]; then
  exit 1
fi
