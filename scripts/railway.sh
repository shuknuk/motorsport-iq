#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${RAILWAY_ENV_FILE:-$ROOT_DIR/.env.railway.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo "Missing Railway env file: $ENV_FILE" >&2
  echo "Copy .env.railway.local.example to .env.railway.local and fill in the Railway values." >&2
  exit 1
fi

set -a
source "$ENV_FILE"
set +a

export RAILWAY_TOKEN

exec "$ROOT_DIR/node_modules/.bin/railway" "$@"
