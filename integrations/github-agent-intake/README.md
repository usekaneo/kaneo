# GitHub agent intake

**Status:** documentation-only placeholder. **Milestone:** [M3](https://github.com/PlaybookMediaLLC/kaneo/issues/9).

Converts founder-approved Kaneo work into an actionable GitHub issue that an **opted-in, unmodified** Orchestrator installation can discover.

## Flow

1. Founder approves a specific feedback-derived implementation brief and confirms repository access.
2. Reuse Kaneo's existing GitHub task/issue synchronization where possible; avoid creating duplicates.
3. Associate the GitHub issue with the Kaneo task and original feedback evidence; attach only appropriately public information.
4. Set the assignee/filter that the founder configured for Orchestrator's GitHub tracker intake. This is the **execution trigger**, not merely a generic issue creation.
5. Verify issue state and idempotency. Record `awaiting_runner` until actual execution evidence is present.
6. On cancellation, remove/disable intake eligibility so a terminated session is not automatically rediscovered.

## Boundaries

Do not permit arbitrary feedback to auto-launch agents. Do not add agent-execution logic to Kaneo's upstream GitHub plugin unless absolutely necessary; prefer this Playbook-owned adapter. GitHub webhooks and Orchestrator polling are not guaranteed instantaneous or always online.

This directory currently has no executable integration.
