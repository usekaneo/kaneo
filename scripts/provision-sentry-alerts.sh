#!/usr/bin/env bash
# Provisions Sentry alert rules from sentry/alerts.json via the Sentry REST API.
# Idempotent: existing alerts with the same name are skipped.
#
# Usage:
#   SENTRY_API_TOKEN=sntrys_... ./scripts/provision-sentry-alerts.sh
#   SENTRY_API_TOKEN=... ./scripts/provision-sentry-alerts.sh --dry-run
#
# The token needs one of: alerts:write, org:admin, org:write, or org:manager scopes.
# Generate at: https://sentry.io/settings/account/api/auth-tokens/
set -euo pipefail

ORG="kaneo"
REGION="de"
API_BASE="https://${REGION}.sentry.io/api/0"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_DIR="$(dirname "$SCRIPT_DIR")"
ALERTS_FILE="${SENTRY_ALERTS_FILE:-${CONFIG_DIR}/sentry/alerts.json}"

DRY_RUN=0
if [ "${1:-}" = "--dry-run" ] || [ "${SENTRY_DRY_RUN:-0}" = "1" ]; then
  DRY_RUN=1
fi

info()   { printf '\033[1;34m[info]\033[0m %s\n' "$*"; }
warn()   { printf '\033[1;33m[warn]\033[0m %s\n' "$*" >&2; }
error()  { printf '\033[1;31m[err]\033[0m  %s\n' "$*" >&2; }
ok()     { printf '\033[1;32m[ok]\033[0m   %s\n' "$*"; }

if [ -z "${SENTRY_API_TOKEN:-}" ]; then
  error "SENTRY_API_TOKEN is not set. Generate one at https://sentry.io/settings/account/api/auth-tokens/ with alerts:write scope."
  exit 1
fi

if [ ! -f "$ALERTS_FILE" ]; then
  error "Alerts config not found at $ALERTS_FILE"
  exit 1
fi

command -v jq >/dev/null || { error "jq is required"; exit 1; }

# Resolve monitor slug -> numeric ID via Sentry API.
# Returns 1 if not found.
resolve_monitor_id() {
  local slug="$1"
  local response
  response=$(curl -fsSL \
    -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
    "${API_BASE}/organizations/${ORG}/monitors/?query=${slug}" 2>/dev/null) || return 1
  echo "$response" | jq -r --arg slug "$slug" \
    '.[] | select(.slug == $slug) | .id' | head -n1
}

# Check whether an alert with this name already exists.
# Returns the ID if found, empty string otherwise.
find_existing_alert() {
  local name="$1"
  local response
  response=$(curl -fsSL \
    -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
    "${API_BASE}/organizations/${ORG}/workflows/?query=${name}" 2>/dev/null) || return 1
  echo "$response" | jq -r --arg name "$name" \
    '.[] | select(.name == $name) | .id' | head -n1
}

# Create a metric detector (used by metric alerts). Returns the new ID.
# Args: detector JSON (without organizationId / projectId).
create_detector() {
  local project="$1"
  local body="$2"
  local response
  response=$(curl -fsSL \
    -X POST \
    -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "${API_BASE}/organizations/${ORG}/projects/${project}/detectors/")
  echo "$response" | jq -r '.id'
}

# Create a workflow (alert rule). Returns the new ID.
create_workflow() {
  local body="$1"
  local response
  response=$(curl -fsSL \
    -X POST \
    -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "$body" \
    "${API_BASE}/organizations/${ORG}/workflows/")
  echo "$response" | jq -r '.id'
}

# Wire a detector into a workflow (POST detector_ids to the workflow).
attach_detector_to_workflow() {
  local workflow_id="$1"
  local detector_id="$2"
  curl -fsSL \
    -X PUT \
    -H "Authorization: Bearer ${SENTRY_API_TOKEN}" \
    -H "Content-Type: application/json" \
    -d "{\"detectorIds\": [\"${detector_id}\"]}" \
    "${API_BASE}/workflows/${workflow_id}/detector/${detector_id}" >/dev/null
}

# Apply a single alert entry from the JSON config.
apply_alert() {
  local alert_json="$1"
  local name type projects workflow_json

  name=$(echo "$alert_json" | jq -r '.name')
  type=$(echo "$alert_json" | jq -r '.kind')

  if [ -z "$name" ] || [ "$name" = "null" ]; then
    error "Alert entry missing name; skipping"
    return 0
  fi

  local existing
  existing=$(find_existing_alert "$name" || true)
  if [ -n "$existing" ]; then
    ok "Alert '$name' already exists (id $existing); skipping"
    return 0
  fi

  info "Creating alert: $name ($type)"

  case "$type" in
    issue)
      projects=$(echo "$alert_json" | jq -r '.projects | join(",")')
      workflow_json=$(echo "$alert_json" | jq --arg org "$ORG" --arg projects "$projects" '
        .workflow + {
          organizationId: $org,
          triggers: {
            logicType: .workflow.triggers.logicType,
            conditions: .workflow.triggers.conditions,
            actions: []
          }
        }
      ')
      if [ "$DRY_RUN" = "1" ]; then
        echo "$workflow_json" | jq .
      else
        local new_id
        new_id=$(create_workflow "$workflow_json")
        ok "Created workflow $new_id"
      fi
      ;;

    metric)
      local detector_id
      detector_id=$(echo "$alert_json" | jq -r '.detector.id // ""')

      if [ -z "$detector_id" ] || [ "$detector_id" = "null" ]; then
        # Try resolving from detector_slugs (cron check-in monitors).
        local slugs
        slugs=$(echo "$alert_json" | jq -r '.detector_slugs | join(" ")')
        local resolved_ids=()

        for slug in $slugs; do
          local id
          id=$(resolve_monitor_id "$slug" || true)
          if [ -z "$id" ]; then
            warn "  cron monitor '$slug' not found in Sentry yet. Have the cron jobs run at least once?"
            continue
          fi
          resolved_ids+=("$id")
          info "  resolved monitor '$slug' -> id $id"
        done
        detector_id=$(echo "${resolved_ids[@]:-}" | tr ' ' '\n' | head -n1)
      fi

      # Create the detector (if we have a body for it).
      local detector_body
      detector_body=$(echo "$alert_json" | jq -r '.detector // empty')
      if [ -n "$detector_body" ]; then
        local project
        project=$(echo "$alert_json" | jq -r '.project')
        detector_body=$(echo "$detector_body" | jq --arg org "$ORG" --arg project "$project" '
          . + {organizationId: $org, projectId: $project}
        ')
        if [ "$DRY_RUN" = "1" ]; then
          echo "$detector_body" | jq .
        else
          local new_detector_id
          new_detector_id=$(create_detector "$project" "$detector_body")
          ok "Created detector $new_detector_id"
          detector_id="$new_detector_id"
        fi
      fi

      # Create the workflow.
      local workflow_body
      workflow_body=$(echo "$alert_json" | jq --arg org "$ORG" --arg det "$detector_id" '
        .workflow + {
          organizationId: $org,
          detectorIds: (if $det != "" then [$det] else [] end)
        }
      ')
      if [ "$DRY_RUN" = "1" ]; then
        echo "$workflow_body" | jq .
      else
        local new_workflow_id
        new_workflow_id=$(create_workflow "$workflow_body")
        ok "Created workflow $new_workflow_id"
      fi
      ;;

    *)
      error "Unknown alert kind '$type' for '$name'; skipping"
      return 0
      ;;
  esac
}

# ---- main ----
info "Reading alerts from $ALERTS_FILE"
[ "$DRY_RUN" = "1" ] && info "DRY RUN: no changes will be made"
info "Organization: $ORG, Region: $REGION"

count=$(jq '.alerts | length' "$ALERTS_FILE")
info "Found $count alert(s) to process"

OK=0
SKIPPED=0
ERRORED=0

for i in $(seq 0 $((count - 1))); do
  ALERT=$(jq -c ".alerts[$i]" "$ALERTS_FILE")
  if apply_alert "$ALERT"; then
    OK=$((OK + 1))
  else
    ERRORED=$((ERRORED + 1))
  fi
done

echo ""
info "Done: $OK created/skipped, $ERRORED errors"
[ "$DRY_RUN" = "1" ] && info "Re-run without --dry-run to apply"
info "Configure per-alert notifications in Sentry: Settings > Alerts > [alert name] > Actions"
