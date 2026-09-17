#!/usr/bin/env bash
# Starts the local diagram dashboard: renders everything, serves a clickable
# gallery with live reload, and re-renders diagrams when their source changes.
#   ./scripts/dashboard.sh [--port 4747] [--no-open]
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v node >/dev/null 2>&1; then
  echo "error: node is required for the dashboard (brew install node)" >&2
  exit 1
fi

exec node scripts/dashboard.mjs "$@"
