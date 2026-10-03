#!/usr/bin/env bash
# The gate every ticket must pass (run by agents AND re-run by the conductor).
set -euo pipefail
cd "$(dirname "$0")/.."
rm -rf e2e-screens
echo "== typecheck"; npm run typecheck
echo "== unit tests"; npm test
echo "== build"; npm run build
echo "== e2e (Playwright vs vite preview of dist)"; npm run e2e
echo "== screenshot checks"; node scripts/check-screenshots.mjs
echo "GATE: PASS"
