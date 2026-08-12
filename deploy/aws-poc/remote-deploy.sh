#!/usr/bin/env bash
# Runs on the EC2 host after code sync. Does NOT touch .env.
# Usage (from /opt/elsetasks): ./deploy/aws-poc/remote-deploy.sh
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/elsetasks}"
IMAGE_TAG="${ELSETASKS_IMAGE:-elsetasks-app:poc}"
cd "$APP_DIR"

if [[ ! -f .env ]]; then
  echo "ERROR: $APP_DIR/.env missing. Create it once on the host (never from CI)." >&2
  exit 1
fi

if [[ ! -f Dockerfile.elsetasks ]]; then
  echo "ERROR: Dockerfile.elsetasks not found in $APP_DIR" >&2
  exit 1
fi

# POC compose must win over monorepo root compose.yml
cp -f deploy/aws-poc/compose.yml ./compose.yml

mkdir -p scripts
cp -f deploy/aws-poc/docuseal-wake.sh scripts/docuseal-wake.sh
cp -f deploy/aws-poc/docuseal-sleep.sh scripts/docuseal-sleep.sh
chmod +x scripts/docuseal-wake.sh scripts/docuseal-sleep.sh

echo "==> Building image ${IMAGE_TAG} (native ARM on host)…"
# compose buildx on this AMI is too old; build with docker directly
docker build -t "$IMAGE_TAG" -f Dockerfile.elsetasks .

echo "==> Starting postgres + elsetasks (DocuSeal stays stopped)…"
ELSETASKS_IMAGE="$IMAGE_TAG" docker compose up -d postgres elsetasks

# Safety: never leave DocuSeal auto-started by a previous compose profile
docker compose stop docuseal >/dev/null 2>&1 || true

echo "==> Waiting for health…"
for i in $(seq 1 36); do
  if curl -fsS "http://127.0.0.1/api/health" >/dev/null 2>&1; then
    echo "OK: /api/health healthy"
    docker compose ps
    exit 0
  fi
  sleep 5
done

echo "WARN: health check timed out; containers status:" >&2
docker compose ps >&2
exit 1
