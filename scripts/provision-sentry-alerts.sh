#!/usr/bin/env bash
# Provisions Sentry alert rules from sentry/alerts.json via the Sentry REST API.
# Idempotent: existing alerts with the same name are skipped.
#
# Usage:
#   SENTRY_API_TOKEN=sntrys_... ./scripts/provision-sentry-alerts.sh
#   SENTRY_API_TOKEN=... ./scripts/provision-sentry-alerts.sh --dry-run
#
# The token needs scope: org:write (or alerts:write).
# Generate at: https://sentry.io/settings/account/api/auth-tokens/
#
# Bugs fixed vs v1:
#   - local + $(...) was swallowing curl failures (subshell + set -e don't mix)
#   - hidden error response body
#   - false success on empty response
#   - jq "Cannot iterate over null" when detector_slugs is missing
#   - missing config.frequency in workflows
#   - cron alert workflows tried to send triggers alongside detectorIds
set -euo pipefail

ORG="kaneo"
REGION="de"
API_BASE="${SENTRY_API_BASE:-https://${REGION}.sentry.io/api/0}"
DEFAULT_FREQUENCY_MIN=30

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(dirname "$SCRIPT_DIR")"
ALERTS_FILE="${SENTRY_ALERTS_FILE:-${CONFIG_DIR}/sentry/alerts.json}"

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
if [ ! -f "$ALERTS_FILE" ]; then
  err "Alerts config not found at $ALERTS_FILE"
  exit 1
fi
command -v jq >/dev/null || { err "jq is required"; exit 1; }

# ---- API helpers ----
# Run an API call. Prints response body on success, returns 0.
# On HTTP >= 400, prints the response body to stderr and returns 1.
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
  # --fail-with-body: exit non-zero on HTTP error, but still write the body
  # to stdout (curl 7.76+). Lets us capture error responses inline.
  status=$(curl -sS --fail-with-body \
    -o "$tmp" \
    -w "%{http_code}" \
    -X "$method" \
    -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    "${body_args[@]}" \
    "$url" 2>/dev/null) || {
    err "HTTP $status from $method $url"
    err "Request body: $body"
    err "Response body:"
    sed 's/^/  /' "$tmp" >&2
    rm -f "$tmp"
    return 1
  }
  cat "$tmp"
  rm -f "$tmp"
}

find_existing_workflow_id() {
  local name="$1"
  local response
  response=$(api_call GET "${API_BASE}/organizations/${ORG}/workflows/?query=${name}") || return 0
  echo "$response" | jq -r --arg name "$name" \
    '.[] | select(.name == $name) | .id' | head -n1
}

# ---- input validation ----
COUNT=$(jq '.alerts | length' "$ALERTS_FILE")
info "Reading $COUNT alert(s) from $ALERTS_FILE"
[ "$DRY_RUN" = "1" ] && info "DRY RUN: no changes will be made"
info "Organization: $ORG, Region: $REGION"

# Validate every alert has a name up front so we don't half-apply.
jq -r '.alerts[] | .name | select(. == null or . == "")' "$ALERTS_FILE" \
  | grep -q . && {
    err "One or more alerts in $ALERTS_FILE have a missing name. Fix and retry."
    exit 1
  }

# ---- main loop ----
APPLIED=0
SKIPPED=0
ERRORS=0

for i in $(seq 0 $((COUNT - 1))); do
  ALERT=$(jq -c ".alerts[$i]" "$ALERTS_FILE")
  NAME=$(echo "$ALERT" | jq -r '.name')
  KIND=$(echo "$ALERT" | jq -r '.kind')

  echo
  info "==== $NAME ($KIND) ===="

  if existing=$(find_existing_workflow_id "$NAME") && [ -n "$existing" ]; then
    ok "Workflow '$NAME' already exists (id $existing); skipping"
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  case "$KIND" in
    issue)
      # Build the workflow payload. Drop empty actions/actionFilters — the
      # api rejects workflows with empty arrays in those fields.
      WORKFLOW=$(echo "$ALERT" | jq --arg org "$ORG" --argjson freq "$DEFAULT_FREQUENCY_MIN" '
        .workflow
        | .organizationId = $org
        | .config = ((.config // {}) + {frequency: $freq})
        | if (.triggers // {}).actions == [] then del(.triggers.actions) else . end
        | if (.triggers // {}).conditions | not then del(.triggers) else . end
        | if (.actionFilters // []) == [] then del(.actionFilters) else . end
      ')

      if [ "$DRY_RUN" = "1" ]; then
        echo "$WORKFLOW" | jq .
        APPLIED=$((APPLIED + 1))
        continue
      fi

      if RESP=$(api_call POST "${API_BASE}/organizations/${ORG}/workflows/" "$WORKFLOW") \
        && NEW_ID=$(echo "$RESP" | jq -r '.id // empty') && [ -n "$NEW_ID" ]; then
        ok "Created workflow $NEW_ID"
        APPLIED=$((APPLIED + 1))
      else
        # RESP is the error body at this point (api_call already printed a
        # detailed error). Just count it.
        ERRORS=$((ERRORS + 1))
      fi
      ;;

    metric)
      # Detect whether the alert references cron monitor slugs (detectors
      # auto-created by Sentry.captureCheckIn) versus inline detector defs.
      HAS_SLUGS=$(echo "$ALERT" | jq -r '.detector_slugs | length > 0')
      HAS_INLINE_DETECTOR=$(echo "$ALERT" | jq -r '.detector | type == "object"')

      DETECTOR_IDS='[]'

      if [ "$HAS_SLUGS" = "true" ]; then
        SLUGS=$(echo "$ALERT" | jq -r '.detector_slugs[]')
        RESOLVED=()
        for slug in $SLUGS; do
          RESP=$(curl -sS -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
            "${API_BASE}/organizations/${ORG}/monitors/?query=${slug}" 2>/dev/null) || {
            err "Monitor lookup failed for '$slug'"
            continue
          }
          id=$(echo "$RESP" | jq -r --arg slug "$slug" \
            '.[] | select(.slug == $slug) | .id' | head -n1)
          if [ -z "$id" ] || [ "$id" = "null" ]; then
            warn "Cron monitor '$slug' not found in Sentry yet. Has the cron run at least once?"
          else
            info "  resolved '$slug' -> id $id"
            RESOLVED+=("$id")
          fi
        done
        if [ "${#RESOLVED[@]}" -eq 0 ]; then
          err "No cron monitors resolved for '$NAME'. Skipping workflow creation."
          ERRORS=$((ERRORS + 1))
          continue
        fi
        DETECTOR_IDS=$(printf '%s\n' "${RESOLVED[@]}" | jq -R . | jq -s .)
      fi

      if [ "$HAS_INLINE_DETECTOR" = "true" ]; then
        PROJECT=$(echo "$ALERT" | jq -r '.project')
        DETECTOR=$(echo "$ALERT" | jq --arg org "$ORG" --arg project "$PROJECT" '
          .detector + {organizationId: $org, projectId: $project}
        ')

        if [ "$DRY_RUN" = "1" ]; then
          echo "[dry-run] would POST detector:"; echo "$DETECTOR" | jq .
        else
          if RESP=$(api_call POST "${API_BASE}/organizations/${ORG}/projects/${PROJECT}/detectors/" "$DETECTOR") \
            && NEW_DET_ID=$(echo "$RESP" | jq -r '.id // empty') && [ -n "$NEW_DET_ID" ]; then
            ok "Created detector $NEW_DET_ID"
            DETECTOR_IDS=$(echo "$DETECTOR_IDS" | jq --arg id "$NEW_DET_ID" '. + [$id]')
          else
            ERRORS=$((ERRORS + 1))
            continue
          fi
        fi
      fi

      # Workflow for metric alerts: detector-only, no triggers. The detector
      # itself fires when its condition matches.
      WORKFLOW=$(echo "$ALERT" | jq --arg org "$ORG" --argjson freq "$DEFAULT_FREQUENCY_MIN" \
        --argjson detectors "$DETECTOR_IDS" '
        {
          name: .workflow.name,
          enabled: (.workflow.enabled // true),
          organizationId: $org,
          config: ((.workflow.config // {}) + {frequency: $freq}),
          detectorIds: $detectors
        }
      ')

      if [ "$DRY_RUN" = "1" ]; then
        echo "[dry-run] would POST workflow:"; echo "$WORKFLOW" | jq .
        APPLIED=$((APPLIED + 1))
        continue
      fi

      if RESP=$(api_call POST "${API_BASE}/organizations/${ORG}/workflows/" "$WORKFLOW") \
        && NEW_ID=$(echo "$RESP" | jq -r '.id // empty') && [ -n "$NEW_ID" ]; then
        ok "Created workflow $NEW_ID"
        APPLIED=$((APPLIED + 1))
      else
        ERRORS=$((ERRORS + 1))
      fi
      ;;

    *)
      err "Unknown kind '$KIND' for '$NAME'"
      ERRORS=$((ERRORS + 1))
      ;;
  esac
done

echo
echo "-----------------------------------------------------------"
info "Done: $APPLIED created, $SKIPPED skipped, $ERRORS failed"
[ "$DRY_RUN" = "1" ] && info "Re-run without --dry-run to apply"
[ "$ERRORS" -gt 0 ] && exit 1
exit 0
