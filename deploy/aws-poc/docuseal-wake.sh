#!/bin/bash
# Run on EC2 under /opt/elsetasks — starts DocuSeal and waits for health.
set -euo pipefail
cd /opt/elsetasks
docker compose up -d docuseal
for i in $(seq 1 60); do
  if curl -fsS http://127.0.0.1:3000 >/dev/null 2>&1 || curl -fsS http://127.0.0.1:3000/up >/dev/null 2>&1; then
    echo "docuseal ready"
    exit 0
  fi
  sleep 2
done
echo "docuseal wake timeout" >&2
exit 1
