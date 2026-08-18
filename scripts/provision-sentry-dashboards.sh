#!/usr/bin/env bash
# Provisions Sentry dashboards from sentry/dashboards.json via the Sentry REST API.
# Idempotent: existing dashboards with the same title are updated in place.
# Preserves any filter settings (projects, environment, period, etc.) the
# maintainer has set in the Sentry UI by reading the current dashboard first
# and only swapping the widgets array.
#
# Usage:
#   SENTRY_API_TOKEN=sntrys_... ./scripts/provision-sentry-dashboards.sh
#   SENTRY_API_TOKEN=... ./scripts/provision-sentry-dashboards.sh --dry-run
#
# The token needs scope: org:write.
# Generate at: https://sentry.io/settings/account/api/auth-tokens/
set -euo pipefail

ORG="kaneo"
REGION="de"
API_BASE="${SENTRY_API_BASE:-https://${REGION}.sentry.io/api/0}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(dirname "$SCRIPT_DIR")"
DASHBOARDS_FILE="${SENTRY_DASHBOARDS_FILE:-${CONFIG_DIR}/sentry/dashboards.json}"

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ] || [ "${SENTRY_DRY_RUN:-0}" = "1" ]; then
  DRY_RUN=1
fi

# ---- output helpers ----
if [ -t 1 ]; then
  C_RESET=$'\033[0m'
  C_INFO=$'\033[1;34m'
  C_OK=$'\033[1;32m'
  C_WARN=$'\033[1;33m'
  C_ERR=$'\033[1;31m'
else
  C_RESET=""; C_INFO=""; C_OK=""; C_WARN=""; C_ERR=""
fi
info() { printf '%s[info]%s %s\n' "$C_INFO" "$C_RESET" "$*"; }
ok()   { printf '%s[ok]%s   %s\n' "$C_OK"   "$C_RESET" "$*"; }
warn() { printf '%s[warn]%s %s\n' "$C_WARN" "$C_RESET" "$*" >&2; }
err()  { printf '%s[err]%s  %s\n' "$C_ERR"  "$C_RESET" "$*" >&2; }

# ---- prerequisites ----
if [ -z "${SENTRY_API_TOKEN:-}" ]; then
  err "SENTRY_API_TOKEN is not set. Generate at https://sentry.io/settings/account/api/auth-tokens/ (scope: org:write)."
  exit 1
fi
if [ ! -f "$DASHBOARDS_FILE" ]; then
  err "Dashboards config not found at $DASHBOARDS_FILE"
  exit 1
fi
command -v jq >/dev/null || { err "jq is required"; exit 1; }

# ---- API helpers ----
api_call() {
  local method="$1"
  local url="$2"
  local body="${3:-}"

  local body_args=()
  if [ -n "$body" ]; then
    body_args+=(-d "$body")
  fi

  local tmp
  tmp=$(mktemp)
  local status
  status=$(curl -sS --fail-with-body \
    -o "$tmp" \
    -w "%{http_code}" \
    -X "$method" \
    -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${body_args[@]}" \
    "$url" 2>/dev/null) || {
    err "HTTP ${status:-?} from $method $url"
    err "Request body: $body"
    err "Response body:"
    [ -s "$tmp" ] && sed 's/^/  /' "$tmp" >&2 || echo "  (empty)" >&2
    rm -f "$tmp"
    return 1
  }
  cat "$tmp"
  rm -f "$tmp"
}

list_dashboards() {
  api_call GET "${API_BASE}/organizations/${ORG}/dashboards/"
}

# Find existing dashboard by title. Returns the full dashboard object.
find_dashboard_by_title() {
  local title="$1"
  list_dashboards | jq -c --arg title "$title" \
    '.[] | select(.title == $title)' | head -n1
}

# POST when id is empty, PUT otherwise. Echoes the new/updated ID.
create_or_update_dashboard() {
  local body="$1"
  local id="${2:-}"
  local method=POST
  local url="${API_BASE}/organizations/${ORG}/dashboards/"
  if [ -n "$id" ]; then
    method=PUT
    url="${url}${id}/"
  fi
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] would $method $url" >&2
    echo "$body" | jq . >&2
    echo "stub-id"
    return 0
  fi
  local resp
  resp=$(api_call "$method" "$url" "$body") || return 1
  echo "$resp" | jq -r '.id // empty'
}

# ---- input validation ----
COUNT=$(jq '.dashboards | length' "$DASHBOARDS_FILE")
info "Reading $COUNT dashboard(s) from $DASHBOARDS_FILE"
[ "$DRY_RUN" = "1" ] && info "DRY RUN: no changes will be made"
info "Organization: $ORG, Region: $REGION"

jq -r '.dashboards[] | select(.title == null or .title == "")' "$DASHBOARDS_FILE" \
  | grep -q . && {
    err "One or more dashboards in $DASHBOARDS_FILE have a missing title. Fix and retry."
    exit 1
  }

# ---- main loop ----
APPLIED=0
ERRORS=0

for i in $(seq 0 $((COUNT - 1))); do
  DASHBOARD=$(jq -c ".dashboards[$i]" "$DASHBOARDS_FILE")
  TITLE=$(echo "$DASHBOARD" | jq -r '.title')

  echo
  info "==== $TITLE ===="

  EXISTING=$(find_dashboard_by_title "$TITLE")
  EXISTING_ID=""
  if [ -n "$EXISTING" ]; then
    EXISTING_ID=$(echo "$EXISTING" | jq -r '.id // empty')
    info "  existing dashboard id $EXISTING_ID \u2014 will update widgets"
  fi

  # Build the request body. On update, merge widgets into the existing
  # dashboard so user-set filters (projects, environment, period, etc.)
  # are preserved. On create, set sensible defaults.
  #
  # The Sentry API requires several fields the spec doesn't repeat:
  # - datasetSource: "user" on every widget (user-defined dashboards)
  # - conditions: "" on every query (default empty)
  # - limit: 10 on widgets that render time series (line/bar/area). The
  #   API rejects widgets without it AND rejects values above 10. Tables
  #   accept it but don't require it, so we skip them.
  if [ -n "$EXISTING_ID" ]; then
    BODY=$(echo "$DASHBOARD" | jq --argjson existing "$EXISTING" '
      {
        title:          $existing.title,
        widgets:        .widgets
                        | map(. + {datasetSource: "user"}
                          + (if .displayType == "table" then {} else {limit: 10} end))
                        | map(.queries = (.queries
                            | map(. + {conditions: ""}))),
        projects:       ($existing.projects       // []),
        environment:    ($existing.environment  // []),
        period:         ($existing.period         // "24h"),
        start:          ($existing.start          // null),
        end:            ($existing.end            // null),
        filters:        ($existing.filters        // {}),
        utc:            ($existing.utc            // false),
        permissions:    ($existing.permissions    // null),
        is_favorited:   ($existing.is_favorited   // false)
      }
    ')
  else
    BODY=$(echo "$DASHBOARD" | jq '
      {
        title:          .title,
        widgets:        .widgets
                        | map(. + {datasetSource: "user"}
                          + (if .displayType == "table" then {} else {limit: 10} end))
                        | map(.queries = (.queries
                            | map(. + {conditions: ""}))),
        projects:       [],
        environment:    [],
        period:         "24h",
        filters:        {},
        utc:            false
      }
    ')
  fi

  if NEW_ID=$(create_or_update_dashboard "$BODY" "$EXISTING_ID") && [ -n "$NEW_ID" ]; then
    if [ -n "$EXISTING_ID" ]; then
      ok "Updated dashboard $NEW_ID"
    else
      ok "Created dashboard $NEW_ID"
    fi
    APPLIED=$((APPLIED + 1))
  else
    ERRORS=$((ERRORS + 1))
  fi
done

echo
echo "-----------------------------------------------------------"
info "Done: $APPLIED applied (created or updated), $ERRORS failed"
[ "$DRY_RUN" = "1" ] && info "Re-run without --dry-run to apply"
[ "$ERRORS" -gt 0 ] && exit 1
exit 0
