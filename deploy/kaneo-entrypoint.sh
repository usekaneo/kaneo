#!/bin/sh
set -eu

# Derive KANEO_API_URL from KANEO_CLIENT_URL if not explicitly set
if [ -z "${KANEO_API_URL:-}" ] && [ -n "${KANEO_CLIENT_URL:-}" ]; then
  export KANEO_API_URL="${KANEO_CLIENT_URL}/api"
  echo "KANEO_API_URL not set — derived from KANEO_CLIENT_URL: $KANEO_API_URL"
fi

# Derive DATABASE_URL from individual postgres vars if not explicitly set
if [ -z "${DATABASE_URL:-}" ]; then
  POSTGRES_DB="${POSTGRES_DB:-kaneo}"
  POSTGRES_USER="${POSTGRES_USER:-kaneo}"
  if [ -n "${POSTGRES_PASSWORD:-}" ]; then
    export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@postgres:5432/${POSTGRES_DB}"
    echo "DATABASE_URL not set — derived from POSTGRES_* vars"
  else
    echo "ERROR: DATABASE_URL is not set and POSTGRES_PASSWORD is not set" >&2
    exit 1
  fi
fi

# Auto-generate AUTH_SECRET if not set
if [ -z "${AUTH_SECRET:-}" ]; then
  export AUTH_SECRET="$(openssl rand -hex 32)"
  echo "WARNING: AUTH_SECRET not set — generated a random secret for this session."
  echo "WARNING: Set AUTH_SECRET in your .env to persist sessions across restarts."
fi

/docker-entrypoint.d/env.sh

node --enable-source-maps /app/apps/api/dist/index.js &
api_pid=$!

echo "Waiting for API to be ready..."
until wget --spider --quiet http://127.0.0.1:1337/api/health 2>/dev/null; do
  if ! kill -0 "$api_pid" 2>/dev/null; then
    echo "API process exited unexpectedly"
    exit 1
  fi
  sleep 1
done
echo "API is ready"

nginx -g "daemon off;" &
nginx_pid=$!

cleanup() {
  kill "$api_pid" "$nginx_pid" 2>/dev/null || true
}

trap cleanup INT TERM

while kill -0 "$api_pid" 2>/dev/null && kill -0 "$nginx_pid" 2>/dev/null; do
  sleep 1
done

cleanup

wait "$api_pid" || api_status=$?
wait "$nginx_pid" || nginx_status=$?

api_status=${api_status:-0}
nginx_status=${nginx_status:-0}

if [ "$api_status" -ne 0 ]; then
  exit "$api_status"
fi

exit "$nginx_status"
