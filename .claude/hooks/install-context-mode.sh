#!/bin/bash
# Installs the context-mode plugin in Claude Code cloud sessions.
# Cloud sessions ignore enabledPlugins/extraKnownMarketplaces from
# .claude/settings.json, so the plugin has to be installed explicitly.
[ "$CLAUDE_CODE_REMOTE" = "true" ] || exit 0

if claude plugin list 2>/dev/null | grep -q "context-mode@context-mode"; then
  exit 0
fi

claude plugin marketplace add mksglu/context-mode >&2 || true
claude plugin install context-mode@context-mode --scope user >&2 || true
exit 0
