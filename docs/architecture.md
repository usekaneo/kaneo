# Product architecture (proposed, not implemented)

## Product premise

Build a feedback-to-delivery system for **independent software founders**. Combine:

1. **UserJot-like capabilities we build ourselves:** product-specific feedback portals, embeddable widgets, votes, comments, evidence, triage, roadmap, changelog and requester updates.
2. **Kaneo upstream project management:** workspaces, projects, tasks, statuses, comments, permissions, GitHub synchronization, REST APIs and MCP.
3. **Unmodified Orchestrator.inc:** optional independent local desktop/daemon application that acts on eligible GitHub issues using the founder's own installed coding agents.

There is **one founder-facing web product**, but not one process or one shared database. The web product is the authority for feedback and decisions; Kaneo handles work; GitHub links approved work to code; Orchestrator may perform the work on the founder's computer.

## Ownership boundaries

| Surface | Owner and policy |
| --- | --- |
| `apps/api`, `apps/web`, `packages/libs`, and existing Kaneo packages | Upstream-first; integrate through extension points and the smallest possible changes |
| `apps/feedback-portal`, `apps/feedback-widget`, `packages/feedback` | Playbook-owned, customer-facing feedback surface and domain |
| `packages/feedback-mcp` | Playbook-owned additional MCP tools built on the existing Kaneo authentication and authorization model |
| `integrations/github-agent-intake` | Playbook-owned approval-to-GitHub handoff and idempotency logic |
| `integrations/orchestrator` | Playbook-owned setup instructions, compatibility checks, and potentially a separate local bridge |
| `vendor/orchestrator` | Optional upstream source pointer only; never patch Orchestrator in place |
| `packages/execution-contracts` | Playbook-owned proposed provider-neutral types, only when a direct runner is needed |
| `branding` | Entirely original customer-facing names, visual assets and copy |

## First operational path: no custom runner

```text
Customer portal / embedded widget
    -> feedback record and evidence (Playbook)
    -> triage / approval (founder)
    -> linked task (Kaneo)
    -> GitHub issue created or synchronized by Kaneo
    -> explicit intake signal (approved issue + configured assignee)
    -> optional Orchestrator installation polls matching issues
    -> local Claude Code / Codex / OpenCode worker
    -> branch, tests, GitHub PR, CI and review
    -> Kaneo task / Playbook feedback view updated from authoritative GitHub evidence
    -> deployment or founder-verified release
    -> changelog and customer notification
```

The spelling of the base project is Kaneo. New code and documentation should consistently use `Kaneo`.

**A click in the website is not itself remote execution.** In the MVP, the user first installs and configures the unmodified Orchestrator app, the local coding agent, the repository, and GitHub tracker intake. The approved GitHub issue is the handoff. Offline installations or failures to meet intake filters must remain visible as `awaiting runner`, not `running`.

Kaneo's existing GitHub integration creates an issue from a task in supported configurations. Additional code is needed to assign or label an **approved** issue for the Orchestrator intake. Avoid creating second issues or triggering execution on every task edit.

## Data model: planned

Keep public feedback separate from Kaneo's internal task table. Plan at least:

- `feedback_product`: belongs to an authorized Kaneo workspace; maps to one or more engineering projects/repositories where appropriate.
- `feedback_request`, `feedback_comment`, `feedback_vote`, `feedback_customer`: raw evidence, participation and product scope.
- `feedback_request_task`: many-to-many feedback-to-Kaneo-task linkage.
- `feedback_subscription`: who should be notified, with consent and preferences.
- `release`, `release_item`: verified, attributable customer-facing changes.
- Optional: `execution_run` and `execution_event` only when the local bridge is justified.

Keep existing Kaneo permissions, tenancy boundaries, and task IDs authoritative. Public feedback APIs need separate customer/guest authorization and strict rate limits; no public feedback endpoint should expose internal task details, private attachments, access tokens or agent instructions. Treat feedback content and screenshots as untrusted, including when passed into a coding agent's implementation brief.

## State and evidence

Distinguish `requested`, `under_review`, `planned`, `in_progress`, `in_review`, `implemented`, and `released`. A merged PR is **not** automatically a deployed release. Do not notify customers that their request shipped until an authoritative deployment signal is available or an authorized founder manually verifies release.

Each handoff needs an idempotency key and durable mappings: feedback ID(s) -> Kaneo task ID -> GitHub issue/PR -> release. Do not use an in-process emitter as the only source of durable execution jobs.

## Optional second path: local bridge

If customers need live agent logs, send-follow-up, stop, or retry from the web interface, add a **separate Playbook-owned local companion** that makes an outbound authenticated connection to Kaneo and talks to Orchestrator's loopback API locally. Never publish the unauthenticated primary daemon listener to the internet. Never collect Claude Code subscription credentials. The founder signs in using the supported official CLI.

Do not require this bridge, hosted AI, or a paid cloud control plane for the first useful release.

## Source layout

See the directory-level README files and [milestones](milestones/README.md). The current scaffold contains **only documentation**, not new package manifests, API routes, queues, credentials or workflow YAML.
