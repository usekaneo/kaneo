#!/usr/bin/env bash
set -euo pipefail

compose=(docker compose --env-file /dev/null -p kaneo-ci -f scripts/ci/compose.yml)
"${compose[@]}" up -d --no-deps gateway
for mapping in APP:15173 SECOND:15174 UPGRADE:15175 MINIO:19040; do
  name=${mapping%%:*}
  port=${mapping##*:}
  address=$("${compose[@]}" port gateway "$port")
  if [[ ! "$address" =~ ^127\.0\.0\.1:[0-9]+$ ]]; then
    printf 'Unexpected gateway address: %s\n' "$address" >&2
    exit 1
  fi
  printf 'KANEO_CI_%s_ORIGIN=http://%s\n' "$name" "$address"
done
