#!/usr/bin/env bash
# Idempotently create native GitHub milestones and assign the existing roadmap issues.
# Run in GitHub Actions with issues:write and GH_TOKEN, or locally with gh auth login.
set -euo pipefail

: "${GH_REPO:=PlaybookMediaLLC/kaneo}"
if ! command -v gh >/dev/null 2>&1; then
  echo "GitHub CLI (gh) is required." >&2
  exit 1
fi

ensure_milestone() {
  local title="$1"
  local description="$2"
  local existing
  existing="$(gh api --paginate "repos/${GH_REPO}/milestones?state=all&per_page=100" \
    | jq -r --arg title "$title" '.[] | select(.title == $title) | .number' \
    | awk 'NR == 1 { print }')"

  if [[ -n "$existing" ]]; then
    printf '%s\n' "$existing"
    return
  fi

  gh api -X POST "repos/${GH_REPO}/milestones" \
    -f title="$title" -f description="$description" -f state=open \
    --jq '.number'
}

assign_issue() {
  local issue_number="$1"
  local milestone_number="$2"
  local existing
  existing="$(gh api "repos/${GH_REPO}/issues/${issue_number}" --jq '.milestone.number // empty')"
  if [[ "$existing" == "$milestone_number" ]]; then
    echo "Unchanged issue #${issue_number} -> milestone #${milestone_number}"
    return
  fi
  gh api -X PATCH "repos/${GH_REPO}/issues/${issue_number}" \
    -F milestone="$milestone_number" --silent
  echo "Assigned issue #${issue_number} -> milestone #${milestone_number}"
}

m0="$(ensure_milestone   'M0 — Foundation and upstream boundaries'   'Repository foundation, data and API contracts, security, upstream Kaneo compatibility, and UserJot feature-parity research. Parent tracker #6; detailed work #15–#25.')"
m1="$(ensure_milestone   'M1 — Customer feedback and UserJot parity'   'Independent-founder feedback boards, feature requests, public roadmap, changelog, widget, headless REST/MCP, AI feedback analysis, Slack intake, moderation and customer identity. Parent #7; implementation #26–#55. P0/P1/P2 detailed in #7.')"
m2="$(ensure_milestone   'M2 — Triage and Kaneo task linkage'   'Convert customer evidence and founder decisions into canonical Kaneo tasks without duplicating project management. Parent tracker #8.')"
m3="$(ensure_milestone   'M3 — GitHub handoff and Orchestrator intake'   'Founder-approved Kaneo work creates a GitHub issue discoverable by an unmodified, independently installed Orchestrator coding agent. Parent tracker #9.')"
m4="$(ensure_milestone   'M4 — Feedback-aware MCP and API integrations'   'Authorized Claude Code and other agent clients can read feedback and propose execution work through Kaneo REST/MCP without subscription-token brokering. Parent tracker #10.')"
m5="$(ensure_milestone   'M5 — Verified releases and customer close-the-loop'   'Link implementation evidence, PRs, deployments, customer changelogs and requester notifications; merging a PR is not proof of release. Parent tracker #11.')"
m6="$(ensure_milestone   'M6 — Founder onboarding, brand and launch readiness'   'Original product identity, safe independent-founder onboarding, integrations, security and full workflow release checks. Parent tracker #12.')"
m7="$(ensure_milestone   'M7 — Optional runner bridge and managed execution'   'Deferred: optional local bridge, live agent controls and sandboxed managed execution only after demand is verified. Parent tracker #13.')"

echo "Native milestones: M0=#${m0}, M1=#${m1}, M2=#${m2}, M3=#${m3}, M4=#${m4}, M5=#${m5}, M6=#${m6}, M7=#${m7}"

for issue in 6 {15..25}; do assign_issue "$issue" "$m0"; done
for issue in 7 {26..55}; do assign_issue "$issue" "$m1"; done
assign_issue 8 "$m2"
assign_issue 9 "$m3"
assign_issue 10 "$m4"
assign_issue 11 "$m5"
assign_issue 12 "$m6"
assign_issue 13 "$m7"

echo "Created/verified all eight GitHub milestones and assigned 49 existing issues."
