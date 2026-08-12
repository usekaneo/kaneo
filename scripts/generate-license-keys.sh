#!/usr/bin/env bash
# Generate marketplace license keys (offline helper).
# Usage: ./scripts/generate-license-keys.sh local 5
set -euo pipefail

SKU="${1:-local}"
COUNT="${2:-1}"

prefix() {
  case "$1" in
    local) echo "ET-LOCAL" ;;
    cloud_monthly) echo "ET-CLOUD-M" ;;
    cloud_yearly) echo "ET-CLOUD-Y" ;;
    support) echo "ET-SUP" ;;
    *) echo "ET-LOCAL" ;;
  esac
}

P="$(prefix "$SKU")"
echo "sku=$SKU count=$COUNT"
for ((i=1; i<=COUNT; i++)); do
  SUFFIX="$(openssl rand -hex 6 | tr '[:lower:]' '[:upper:]')"
  echo "${P}-${SUFFIX}"
done
