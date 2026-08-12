#!/bin/bash
# Run on EC2 under /opt/elsetasks — stops DocuSeal to save RAM/CPU.
set -euo pipefail
cd /opt/elsetasks
docker compose stop docuseal || true
echo "docuseal stopped"
