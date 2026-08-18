#!/usr/bin/env bash
# Provisions Sentry alert rules from sentry/alerts.json via the Sentry REST API.
# Idempotent: existing alerts with the same name are updated in place. Detectors
# are matched by the workflow's detectorIds[0]. Cron monitor detectors are
# re-resolved by slug on every run.
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
#   - v2: alerts were create-only; edited spec never propagated. now uses PUT.
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

# Sentry's `?query=` parameter is tokenized (e.g. `is:unresolved`, `project:foo`),
# not free-text. Names like "Kaneo API: New issue" parse as broken search tokens.
# Easier to fetch all and filter client-side: at most ~10 alerts in this org.
list_workflows() {
  api_call GET "${API_BASE}/organizations/${ORG}/workflows/"
}

list_monitors() {
  api_call GET "${API_BASE}/organizations/${ORG}/monitors/"
}

find_existing_workflow() {
  # Returns the full workflow object as compact JSON, or empty string.
  local name="$1"
  local response
  response=$(list_workflows) || return 0
  echo "$response" | jq -c --arg name "$name" \
    '.[] | select(.name == $name)' | head -n1
}

# ---- POST/PUT helpers ----
# POST if id is empty, PUT otherwise. Echoes the new/updated ID.
create_or_update_workflow() {
  local body="$1"
  local id="${2:-}"
  local method=POST
  local url="${API_BASE}/organizations/${ORG}/workflows/"
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

create_or_update_detector() {
  local project="$1"
  local body="$2"
  local id="${3:-}"
  local method=POST
  local url="${API_BASE}/organizations/${ORG}/projects/${project}/detectors/"
  if [ -n "$id" ]; then
    method=PUT
    url="${url}${id}/"
  fi
  if [ "$DRY_RUN" = "1" ]; then
    echo "[dry-run] would $method $url" >&2
    echo "$body" | jq . >&2
    echo "stub-detector-id"
    return 0
  fi
  local resp
  resp=$(api_call "$method" "$url" "$body") || return 1
  echo "$resp" | jq -r '.id // empty'
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
ERRORS=0

for i in $(seq 0 $((COUNT - 1))); do
  ALERT=$(jq -c ".alerts[$i]" "$ALERTS_FILE")
  NAME=$(echo "$ALERT" | jq -r '.name')
  KIND=$(echo "$ALERT" | jq -r '.kind')

  echo
  info "==== $NAME ($KIND) ===="

  # Find existing workflow (full object, or empty string). The script
  # discriminates create vs update on whether this returns a value.
  EXISTING=$(find_existing_workflow "$NAME")
  EXISTING_ID=""
  if [ -n "$EXISTING" ]; then
    EXISTING_ID=$(echo "$EXISTING" | jq -r '.id // empty')
    info "  existing workflow id $EXISTING_ID \u2014 will update"
  fi

  case "$KIND" in
    issue)
      # Build the workflow payload. Drop empty actions/actionFilters \u2014 the
      # api rejects workflows with empty arrays in those fields.
      WORKFLOW=$(echo "$ALERT" | jq --arg org "$ORG" --argjson freq "$DEFAULT_FREQUENCY_MIN" '
        .workflow
        | .organizationId = $org
        | .config = ((.config // {}) + {frequency: $freq})
        | if (.triggers // {}).actions == [] then del(.triggers.actions) else . end
        | if (.triggers // {}).conditions | not then del(.triggers) else . end
        | if (.actionFilters // []) == [] then del(.actionFilters) else . end
      ')

      if NEW_ID=$(create_or_update_workflow "$WORKFLOW" "$EXISTING_ID") && [ -n "$NEW_ID" ]; then
        if [ -n "$EXISTING_ID" ]; then
          ok "Updated workflow $NEW_ID"
        else
          ok "Created workflow $NEW_ID"
        fi
        APPLIED=$((APPLIED + 1))
      else
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
        RESP=$(list_monitors) || {
          err "Monitor lookup failed for '$NAME'"
          ERRORS=$((ERRORS + 1))
          continue
        }
        RESOLVED=()
        for slug in $SLUGS; do
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
          err "No cron monitors resolved for '$NAME'. Skipping."
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

        # On update, find the existing detector id from the workflow's
        # detectorIds. On create, it is empty.
        EXISTING_DET_ID=""
        if [ -n "$EXISTING_ID" ]; then
          EXISTING_DET_ID=$(echo "$EXISTING" | jq -r '.detectorIds[0] // empty')
        fi

        if NEW_DET_ID=$(create_or_update_detector "$PROJECT" "$DETECTOR" "$EXISTING_DET_ID") && [ -n "$NEW_DET_ID" ]; then
          if [ -n "$EXISTING_DET_ID" ]; then
            ok "Updated detector $NEW_DET_ID"
          else
            ok "Created detector $NEW_DET_ID"
          fi
          DETECTOR_IDS=$(echo "$DETECTOR_IDS" | jq --arg id "$NEW_DET_ID" '. + [$id]')
        else
          ERRORS=$((ERRORS + 1))
          continue
        fi
      fi

      # Workflow for metric alerts: detectorOnly is the firing model, but the
      # API still expects a `triggers` field on every workflow. Empty conditions
      # are fine; the detector drives notification when the threshold trips.
      WORKFLOW=$(echo "$ALERT" | jq --arg org "$ORG" --argjson freq "$DEFAULT_FREQUENCY_MIN" \
        --argjson detectors "$DETECTOR_IDS" '
        {
          name: .workflow.name,
          enabled: (.workflow.enabled // true),
          organizationId: $org,
          config: ((.workflow.config // {}) + {frequency: $freq}),
          detectorIds: $detectors,
          triggers: {
            logicType: "any-short",
            conditions: []
          }
        }
      ')

      if NEW_ID=$(create_or_update_workflow "$WORKFLOW" "$EXISTING_ID") && [ -n "$NEW_ID" ]; then
        if [ -n "$EXISTING_ID" ]; then
          ok "Updated workflow $NEW_ID"
        else
          ok "Created workflow $NEW_ID"
        fi
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
info "Done: $APPLIED applied (created or updated), $ERRORS failed"
[ "$DRY_RUN" = "1" ] && info "Re-run without --dry-run to apply"
[ "$ERRORS" -gt 0 ] && exit 1
exit 0
