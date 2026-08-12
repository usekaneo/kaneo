#!/usr/bin/env bash
# Provision an isolated ElseTasks Cloud stack for one customer.
# Usage: ./scripts/provision-customer.sh acme
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SLUG="${1:-}"
BASE_DOMAIN="${ELSETASKS_BASE_DOMAIN:-elsetasks.com}"

if [[ -z "$SLUG" ]]; then
  echo "Usage: $0 <customer-slug>"
  exit 1
fi

if [[ ! "$SLUG" =~ ^[a-z0-9-]+$ ]]; then
  echo "Slug must be lowercase alphanumeric/hyphen"
  exit 1
fi

DIR="$ROOT/deploy/customers/$SLUG"
mkdir -p "$DIR"

if [[ -f "$DIR/.env" ]]; then
  echo "Customer $SLUG already exists at $DIR"
  exit 1
fi

PASS="$(openssl rand -hex 16)"
SECRET="$(openssl rand -hex 32)"

cp "$ROOT/compose.hosted.template.yml" "$DIR/compose.yml"

cat > "$DIR/.env" <<EOF
CUSTOMER_SLUG=$SLUG
ELSETASKS_BASE_DOMAIN=$BASE_DOMAIN
ELSETASKS_IMAGE=${ELSETASKS_IMAGE:-elsetasks-app:local}
POSTGRES_PASSWORD=$PASS
AUTH_SECRET=$SECRET
APP_NAME=ElseTasks
APP_SUPPORT_EMAIL=suporte@elsetasks.com
APP_PRIMARY_COLOR=#0F766E
EOF

echo "Created $DIR"
echo "URL: https://$SLUG.$BASE_DOMAIN"
echo "Start with:"
echo "  cd $DIR && docker compose --env-file .env up -d"
