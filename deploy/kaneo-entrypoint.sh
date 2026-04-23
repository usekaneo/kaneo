#!/bin/sh
set -eu

urlencode() {
  node -e 'const input = process.argv[1]; process.stdout.write(encodeURIComponent(input).replace(/[!\x27()*]/g, (char) => `%${char.charCodeAt(0).toString(16).toUpperCase()}`));' "$1"
}

api_pid=""
nginx_pid=""

cleanup() {
  if [ -n "$api_pid" ]; then
    kill "$api_pid" 2>/dev/null || true
  fi

  if [ -n "$nginx_pid" ]; then
    kill "$nginx_pid" 2>/dev/null || true
  fi
}

trap cleanup EXIT INT TERM

# Derive KANEO_API_URL from KANEO_CLIENT_URL if not explicitly set
client_url_trimmed="$(printf '%s' "${KANEO_CLIENT_URL:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
if [ -z "${KANEO_API_URL:-}" ] && [ -n "$client_url_trimmed" ]; then
  export KANEO_API_URL="${client_url_trimmed}/api"
  echo "KANEO_API_URL not set — derived from KANEO_CLIENT_URL: $KANEO_API_URL"
fi

# Derive DATABASE_URL from individual postgres vars if not explicitly set
if [ -z "${DATABASE_URL:-}" ]; then
  POSTGRES_DB="${POSTGRES_DB:-kaneo}"
  POSTGRES_USER="${POSTGRES_USER:-kaneo}"
  if [ -n "${POSTGRES_PASSWORD:-}" ]; then
    encoded_user="$(urlencode "$POSTGRES_USER")"
    encoded_password="$(urlencode "$POSTGRES_PASSWORD")"
    export DATABASE_URL="postgresql://${encoded_user}:${encoded_password}@postgres:5432/${POSTGRES_DB}"
    echo "DATABASE_URL not set — derived from POSTGRES_* vars"
  else
    echo "ERROR: DATABASE_URL is not set and POSTGRES_PASSWORD is not set" >&2
    exit 1
  fi
fi

# Auto-generate AUTH_SECRET if not set
if [ -z "${AUTH_SECRET:-}" ]; then
  export AUTH_SECRET="$(node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex"))')"
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
