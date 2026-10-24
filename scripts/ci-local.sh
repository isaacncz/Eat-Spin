#!/usr/bin/env bash
# Runs the blocking checks from .github/workflows/ci.yml locally, the way CI runs them,
# so a push does not cost a red CI run (and a wasted Netlify deploy preview).
#
#   npm run ci:local            typecheck, unit tests, Playwright critical flows
#   npm run ci:local -- --quick typecheck and unit tests only
#
# Not covered: "Shared list and group Firebase rules" (needs the Firebase emulator and Java).
# ESLint and the legacy cache script are advisory in CI, so they are not run here.
# EATSPIN_PW_CONFIG=path/to/config.ts points Playwright at another config (e.g. a custom browser path).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

quick=false
[[ "${1:-}" == "--quick" ]] && quick=true

step() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }

step "Typecheck (tsc -b)"
npx tsc -b

step "Unit tests (Vitest)"
npm run test:unit --silent

if $quick; then
  printf '\n\033[32m✔ Quick CI checks passed\033[0m\n'
  exit 0
fi

step "Playwright critical flows (chromium + mobile, as in CI)"
# CI=true gives CI's retries, single worker and a fresh dev server. Empty keys override any
# local .env so the app uses the bundled fallback places, like CI (which has no secrets).
CI=true \
VITE_GOOGLE_MAPS_API_KEY= \
VITE_FIREBASE_API_KEY= VITE_FIREBASE_AUTH_DOMAIN= VITE_FIREBASE_DATABASE_URL= \
VITE_FIREBASE_PROJECT_ID= VITE_FIREBASE_APP_ID= \
npx playwright test --reporter=line ${EATSPIN_PW_CONFIG:+-c "$EATSPIN_PW_CONFIG"} \
  tests/smoke.spec.ts \
  tests/result-screen.spec.ts \
  tests/group-me-screens.spec.ts \
  tests/critical-

printf '\n\033[32m✔ Local CI passed\033[0m\n'
