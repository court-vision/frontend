#!/usr/bin/env bash
# Headless-Chrome screenshots of the app at phone/tablet/desktop sizes.
#
#   scripts/mobile-shots.sh                       # 390x844 + 768x1024, default routes
#   SIZES=1280x800 OUT=.mobile-shots/baseline scripts/mobile-shots.sh
#   ROUTES="/rankings /matchup" scripts/mobile-shots.sh
#
# Requires `bun run dev` (or any server) on BASE_URL. Protected routes render
# the Clerk sign-in page here; sign in once in Chrome + DevTools device mode
# to check those.
#
# Chrome is driven over the DevTools Protocol (scripts/mobile-shots.ts) with
# device-metrics emulation: a plain `--headless --screenshot --window-size`
# clamps to Chrome's ~500 px minimum window width, so phone layouts came out
# cropped. Sizes below 768 px also emulate touch (`pointer: coarse`).
set -euo pipefail

export CHROME="${CHROME:-/Applications/Google Chrome.app/Contents/MacOS/Google Chrome}"
export BASE_URL="${BASE_URL:-http://localhost:3000}"
export OUT="${OUT:-.mobile-shots}"
export SIZES="${SIZES:-390x844 768x1024}"
export ROUTES="${ROUTES:-/ /rankings /sign-in /terminal /query-builder}"

if [[ ! -x "$CHROME" ]]; then
  echo "mobile-shots: Chrome not found at $CHROME (set CHROME=...)" >&2
  exit 1
fi

if ! command -v bun >/dev/null 2>&1; then
  echo "mobile-shots: bun is not on PATH" >&2
  exit 1
fi

if ! curl -sf -o /dev/null --max-time 5 "$BASE_URL"; then
  echo "mobile-shots: nothing is serving $BASE_URL — start \`bun run dev\` first" >&2
  exit 1
fi

exec bun "$(dirname "$0")/mobile-shots.ts"
