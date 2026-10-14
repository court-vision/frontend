#!/usr/bin/env bash
# Starts the Playwright MCP server for Claude Code (registered in .mcp.json).
# Claude reads pages as accessibility snapshots (text) instead of screenshots.
# Cloud sessions ship Chromium at /opt/pw-browsers and need --no-sandbox;
# locally it falls back to the installed Chrome.
set -euo pipefail
args=(--isolated --output-dir .playwright-mcp)
if [ -x /opt/pw-browsers/chromium ]; then
  args+=(--headless --no-sandbox --executable-path /opt/pw-browsers/chromium)
fi
exec npx -y @playwright/mcp@0.0.83 "${args[@]}"
