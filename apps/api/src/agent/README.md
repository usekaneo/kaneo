# Agent backend

The assistant uses AI SDK language-model providers, including direct Anthropic, OpenAI, Google, cloud providers, and OpenRouter. It reads Kaneo through scoped tools and stores concrete proposals. Applying a proposal is a separate authenticated domain operation and does not call a model. The API worker runs in the same process; PostgreSQL provides the queue, run leases, receipts, and mutation outbox. Redis remains optional.

## Configuration

Set server configuration in the root `.env`:

```dotenv
KANEO_AGENT_ENABLED=true
KANEO_AGENT_MODEL=anthropic:claude-sonnet-5-5
ANTHROPIC_API_KEY=your-key
```

See [model providers](./providers/README.md) for all bundled adapters, mixed-provider model lists, local endpoints, community adapters, and usage limitations. API-key variables also support a `_FILE` suffix. Credentials are never returned by the agent API. The feature is disabled unless explicitly enabled with valid configuration. Existing history, cancellation, review, and undo remain available if model access is disabled.

| Setting | Default | Allowed values |
| --- | --- | --- |
| `KANEO_AGENT_MODEL` | `OPENROUTER_MODEL`, then `openai/gpt-6-luna` | `provider:model` ID with tool support; unqualified IDs retain OpenRouter routing |
| `KANEO_AGENT_MODELS` | `OPENROUTER_MODELS`, then unset | Comma-separated model IDs users may pick per run, up to 20 including the default |
| `KANEO_AGENT_MAX_STEPS` | 8 | 1–12 model steps |
| `KANEO_AGENT_MAX_OUTPUT_TOKENS` | 2048 | 256–4096 per step |
| `KANEO_AGENT_TIMEOUT_MS` | 120000 | 10000–300000 |
| `KANEO_AGENT_CONCURRENCY` | 1 | 1–4 runs per API process |
| `KANEO_AGENT_PROVIDERS_MODULE` | unset | Absolute path to a trusted ESM module exporting additional SDK providers |
| `OPENROUTER_ZDR` | false | `true` restricts inference to ZDR endpoints |

The default model is always allowed. When the model list includes other models, the composer shows a model picker and runs may request any listed model; the API rejects others with 400. Invalid entries disable the agent, like other invalid settings. Existing OpenRouter environment variables and saved model IDs continue to work.

Workspace context is sent to the selected provider. OpenRouter routing disallows provider data collection; direct-provider policies are configured with those providers. Runs record token usage and OpenRouter-reported `costUsd`; other providers leave dollar cost null. These limits bound work, but do not constitute a dollar budget. Enforce spending limits with your provider.

## HTTP contract

All paths below are relative to `/api/agent/{workspaceId}`. Use the existing session authentication and the typed `client.agent` from `@kaneo/libs`. Agent endpoints do not accept API keys. Conversations and runs belong to their creator and are private by default, including from workspace admins; the creator can share a conversation with the workspace (see [Sharing](#sharing)). Current permissions and account bans are checked before model execution, before tools, and during review.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/config` | Availability, default `model`, allowed `models` (`{id, label}`), and limits |
| POST | `/conversations` | Create with optional `projectId` and `title`; omitting the project scopes reads to the workspace |
| GET | `/conversations?limit=20&offset=0&projectId=` | Your conversation history, optionally for one project; never includes others' shared conversations |
| GET | `/conversations/{conversationId}` | A conversation you own or that is shared with you, with `sharedAt` and `owner` (`{id, name, image}`) |
| POST | `/conversations/{conversationId}/share` | Owner only: share the whole conversation with the workspace; idempotent |
| POST | `/conversations/{conversationId}/unshare` | Owner only: make it private again; revokes access immediately |
| POST | `/conversations/{conversationId}/runs` | Queue `{requestId: UUID, prompt, attachments?, model?, mentions?}`; returns `{id, status}` with 202 |
| GET | `/conversations/{conversationId}/runs` | Run history, same pagination; owner or shared viewer |
| GET | `/runs?limit=20&offset=0` | Your recent runs plus runs shared with you, newest first, with pending/applied proposal counts, `shared`, and `owner` |
| GET | `/runs/{runId}` | Response, status, tool progress, proposals, usage, cost; owner or shared viewer |
| GET | `/runs/{runId}/events` | Authenticated SSE snapshots; owner or shared viewer |
| POST | `/runs/{runId}/cancel` | Owner only: cancel queued/running work |
| POST | `/runs/{runId}/apply` | Owner only: apply selected `{proposalIds: [...]}` |
| POST | `/runs/{runId}/discard` | Owner only: discard selected pending proposals |
| POST | `/proposals/{proposalId}/undo` | Owner only: undo an applied task update or comment |
| POST | `/attachments` | Upload `{name, mediaType, data}` (base64 image or PDF); returns `{id, name, mediaType, size}` with 201 |
| GET | `/attachments/{attachmentId}/content` | Attachment bytes for the uploader or a viewer of the shared run; images inline, PDFs as downloads |

`attachments` holds up to five items in total. Text files are sent inline as `{name, content}`, at most 50,000 characters each and 100,000 in total; the web client reads them in the browser. Images (PNG, JPEG, WebP, GIF) and PDFs up to 5 MB are first uploaded to `/attachments` and then referenced as `{id}`. Uploads are stored in PostgreSQL in `agent_attachment`, so no object storage is needed; the run itself keeps only `{id, name, mediaType, size}`. Only the uploader can reference an upload, and only the uploader or a viewer who can read the shared run it was sent in can read it. Each upload can be sent with one run, and at most 20 unsent uploads per user are kept for a day. The runner loads the bytes for the current turn only and sends images and PDFs as AI SDK file parts (PDF parsing and accepted input types depend on the selected provider and model); later turns see just the file names. If no provider for the model accepts image input, the run fails with a stable error the client translates. Run responses return attachment metadata, never contents.

The composer's @-mentions are written into the prompt as `@[Launch v3](project:ID)` or `@[WEB-135 Fix login](task:ID)`, at most ten distinct items per prompt. `mentions` lists the same `{type, id}` references and must match the prompt's tokens; there is no separate column. When the run executes, the runner resolves each reference with the user's current project access and the conversation's project scope, and appends a `<mentioned_items>` block (title, key, status, project) to that turn as untrusted data. Items the user cannot access are dropped silently. Later turns keep only the prompt text.

Repeating a run request with the same `requestId`, prompt, attachments, and model returns the existing run. Reusing it with a different prompt, attachments, or model returns 409. Each conversation has at most one active run; each user has at most two active runs and ten new runs per minute. Selected proposal IDs must be distinct, with at most twenty per request.

SSE emits `run` events containing the same JSON as GET run details, then `done` when the run finishes or reaches `awaiting_review`. Connections close after two minutes; fetch the run and reconnect if it remains active. Use credentialed `fetch` for separately hosted API/web deployments or the existing API URL helper. Run updates also send private `AGENT_RUN_UPDATED` messages to the owner through the existing user WebSocket, containing only `workspaceId` and `runId`; refetch details after receiving them. Shared viewers do not receive these messages (see [Sharing](#sharing)).

## Sharing

Conversations are private by default. The owner can share a conversation with `POST /share`; sharing covers the whole thread, including runs started later, and `agent_conversation.shared_at` records it. `POST /unshare` clears it, and access ends on the next request.

Shared viewers need current workspace `project:read` and `task:read` permissions, access to the conversation's project when scoped, and access to **every project the run touched**. Project access uses the normal rules, including instance-admin and workspace-owner access. Owners retain access to their own runs under the existing workspace and project permission checks. Viewers can read responses, tool progress, proposals, and attachments; only the owner can queue, cancel, apply, discard, undo, or change sharing. Those actions return 403 for visible read-only viewers. Private conversations and hidden runs return 404.

Each run stores a deduplicated `text[]` in `agent_run.touched_project_ids`, starting with the conversation's project when scoped:

| Source | Projects recorded |
| --- | --- |
| `list_projects` | Every returned project |
| `list_tasks` | Each returned task's project, plus the requested project even for an empty page |
| `get_task` | The task's project |
| `workload` | Every project whose tasks contributed to the returned assignee counts, plus the requested project |
| `list_members` | None; it returns only workspace member data |
| Task creation proposal | The new task's project |
| Coding repository discovery | Every returned repository’s project |
| Code proposal or job creation | The task’s project, including its current project when applied |
| Task update or comment proposal | The task snapshot's project |
| Resolved @-mentions | Each mentioned task's project and each mentioned project |
| Automation queue | The scope project and every event project in the batch, including events beyond the displayed limit |
| Triggering tasks resolved at execution | Each task’s current project, including a new project after a move |
| Earlier turns sent as context | All projects recorded on those turns |
| Attachments | None |

Tool projects are merged atomically in SQL in the same transaction as their completed step, and proposal projects in the same transaction as the proposal snapshot. Mention and history projects are recorded before model execution. Parallel tools cannot overwrite one another's IDs, and a crash cannot leave persisted project data without its recorded scope. The IDs are internal and never returned by the API.

Run detail, SSE snapshots, attachment downloads, conversation run lists, recent runs, automation history, latest-run summaries, and automation cost totals enforce this rule against current project access. Lists filter in SQL before pagination; hidden runs are omitted. Detail snapshots read access, steps, and proposals in one database snapshot so a concurrent tool cannot leak a newly restricted proposal. A shared conversation's header returns 404 when it has runs but none are visible; an empty conversation remains visible. A recorded project that was deleted or belongs to another workspace also hides the run from viewers. Shared attachment responses use `Cache-Control: private, no-store`.

The migration backfills project-scoped runs with their conversation's project. Earlier workspace-scoped runs cannot be reconstructed reliably, so they record the reserved `*` marker, which matches no project and keeps them owner-only even when shared, including from instance admins. Later turns that use those legacy answers as context inherit the marker.

`AGENT_RUN_UPDATED` still goes only to the owner. Finding every eligible member would need a project access check per member on every throttled update, and fan-out would grow with workspace size while viewers are rare. Viewers instead rely on the web's existing polling: run details every 5 seconds while active, and the open conversation's run list every 30 seconds.

## UI handoff

1. Create a conversation scoped to the board project, or to the workspace for the standalone Agent page.
2. Queue a run with a new UUID and render response/progress from persisted snapshots. Render Markdown through Kaneo's existing sanitization path; model text and task descriptions are untrusted.
3. At `awaiting_review`, render pending proposals as overlays. `action` is the proposed patch, creation, or comment, `reason` explains it, and `before` is the server's task snapshot. `after` remains null until applied; for comments it then carries the posted `commentId`. Comment bodies are untrusted Markdown. Never change board cache values just because a proposal exists.
4. Submit only checked proposal IDs to `/apply`. The response contains per-proposal `applied` or `failed` results; conflicts are HTTP 409 codes inside those results. Refetch run details to keep pending selections accurate. Apply is independent per proposal, so some can succeed while others conflict.
5. Applied updates can be undone if their affected fields still equal the applied values. Unrelated teammate edits are preserved. A posted comment can be undone, which deletes it, only while it is unedited; otherwise undo returns 409. Created tasks use the normal task deletion workflow rather than automatic undo.

Actual task changes and comments publish the existing task and comment events, which produce normal board WebSocket messages and existing cache refreshes. The applying tab also receives these messages because the durable effect is delivered outside the original request's initiator context.

## Web UI

`apps/web/src/components/agent/` implements both surfaces. Project views get an **Agent** button (⌘/Ctrl+J) that opens a side panel scoped to the project; pending task updates and comments from the latest run are previewed on matching board cards through `store/agent-panel.ts`. The sidebar's **Agent** page starts workspace-scoped conversations and lists recent runs, including shared ones, with each starter's avatar. The owner shares or stops sharing from the conversation header on the Agent page or in the panel. Shared viewers open a read-only thread without the composer or review controls, with the owner shown in the header. Panel history lists only your own conversations. Both are hidden when `/config` reports the agent disabled or the user is anonymous. The composer is a plain-text Tiptap editor: typing `@` searches tasks (by title or key) and projects through the search API, scoped to the board's project in the panel, and inserts a chip that is sent as a prompt mention. Run details refresh from `AGENT_RUN_UPDATED` on the user WebSocket, with slow polling only while a run is active; the UI does not use the SSE endpoint.

## Scope and guarantees

Tools list projects, members, bounded task pages, task details with recent comments/stored links, and workload counts. Task pages deliberately have no text/status/assignee filters so smaller models do not accidentally exclude the task they need. Workspace-wide inspection uses pagination. Counts describe observed tasks, not a person's capacity or skills; stored links do not establish live PR reviews or CI state.

Supported proposals are task creation, updates to title, priority, assignee, and due date, and task comments. Validation uses current workspace permissions, member assignment rules, project columns, required custom fields, and date constraints. Comments need `task:update`, like the comment API, and are posted as the applying user through the normal comment domain, so mentions and assignee notifications behave like a user comment. Notifications are stored with the comment and delivered by the outbox. The API owns the before snapshot. Applying and undoing compare affected fields and project ownership under database locks. The mutation, receipt, and outbox insertion commit together; retries do not duplicate task creation or comments, or replay mutations.

The outbox dispatches normal events after commit, in proposal order. A process crash can cause event redispatch; delivery is at least once, and downstream handlers retain their existing delivery semantics. It is not an exactly-once guarantee for notifications or integrations. Expired runs fail and discard pending proposals; model calls are not automatically retried after a crash. Cancellation aborts in-flight work when the worker observes it; provider work already performed can still be billed.

Task attachments, subtasks, labels, status changes, and live GitHub queries remain follow-up agent tools. The initial implementation has no arbitrary HTTP, SQL, shell, or integration-secret tool. Run history is durable without automatic retention pruning; there is currently no conversation deletion endpoint.

## Automations

Automations run a saved prompt as its owner, with current membership, account status, project access, permissions, and workspace entitlement. They work in one API process with PostgreSQL; Redis is optional. A minute scheduler uses the existing job lease plus transactional automation row locks. Schedule slots have deterministic request IDs, so overlapping replicas and repeated ticks create at most one run per slot. Downtime does not replay missed slots: one overdue slot runs, then the schedule advances into the future.

Schedules support daily local times, weekly ISO weekdays (Monday = 1), and intervals of 1–24 hours. Persisted IANA time zones default to UTC because user/workspace profiles have no time-zone setting. Wall-clock schedules follow DST: a skipped time runs at the spring clock jump, and a repeated time runs once. Intervals use elapsed hours.

Event triggers are task creation, column moves, passed due dates, comments, PR opening, and PR merging. GitHub, GitLab, and Gitea publish PR events after their domain transaction commits, even when no column transition happens. Project, column-name, and label-name filters combine with AND; names ignore case and surrounding whitespace. A project scope overrides the project filter. Events outside the owner's current project access are discarded. Passed due dates use a persisted cursor starting at creation/re-enable; old overdue tasks are not replayed.

Each automation batches events for five minutes from its first pending match; the minute tick may dispatch up to a minute later. At most 200 pending events are retained and the prompt lists 20, with an additional-event count. Further matches are dropped while the batch is full. Consumed rows retain only their dedupe key and timestamps. Creation IDs, comment IDs, PR integration/number identities, and task move revisions suppress redelivery. These receipts currently have no automatic retention pruning. Event subscription uses the existing in-process event bus: once matched, a batch is durable, but a crash between a domain commit and event delivery can lose that event, just as with other current subscribers.

A run is a normal `agent_run`, with a trigger snapshot, in one conversation per automation/owner/scope. Mentions and triggering tasks resolve again at execution; event text is enclosed in an explicitly untrusted context block. `proposals` uses the existing review/apply/undo path, always owner-only. `digest` exposes read tools only, also rejects proposal persistence server-side, and stores the final response as one private inbox notification linked to the conversation/run. Digests and failure notices stay in the Kaneo inbox and are not forwarded to third-party notification channels. Current notification access checks hide them when membership, permissions, or scope access is revoked.

Defaults and limits:

- 50 automations per owner in a workspace; 24 runs per rolling 24 hours per automation, configurable from 1 to the server maximum of 100. Takeover preserves the automation's run count.
- Existing per-user limits still apply: two active runs and ten new runs per minute. One automation conversation has at most one queued/running run. An overlapping event batch waits; an overlapping schedule slot is skipped.
- `KANEO_AGENT_WORKSPACE_MONTHLY_USD` optionally caps automation spending against all recorded agent costs in that workspace's current UTC month, including interactive runs. Unset/empty means no cap; zero or an invalid value blocks automation spending. Both scheduled/event runs and **Run now** respect this cap. Interactive conversations remain usable. Queueing and worker execution check the cap; unknown provider costs and already-running model calls mean this is a recorded-cost guard, not a hard billing ceiling.
- Budget/daily-limit skips set visible `lastSkipReason` and `lastSkippedAt`. A model removed from the allowlist skips as `unavailable`; it never silently switches models. No model failure is automatically retried. Each failure creates one inbox notification; three consecutive failures pause the automation. Successful runs reset the counter, and expired worker leases count as failures.
- Lost membership, a ban, scope access, required read permissions, or entitlement pauses with `owner_access`. Archived workspaces skip until restored. Admins/owners have `agent:manage_automations`; existing seeded admin roles receive it through the migration. Permission-edited/custom roles use their stored grants.

Only the owner can edit, toggle, delete, or run an automation. Shared viewers can read its prompt and current owner's run history under normal conversation sharing rules. An authorized admin can inspect settings with the prompt/history redacted and explicitly take over. Takeover revokes previous sharing, cancels active old-owner runs, keeps their history private to them, starts with a private conversation for the new owner, and leaves the automation disabled until enabled. Scope changes cancel active runs, revoke prior sharing, and select a private conversation for the new scope; earlier history keeps its original project access boundary and still counts toward caps. Deleting an automation cancels active runs and removes its pending events, while retaining owned conversation history and recorded costs.

All automation paths are relative to `/api/agent/{workspaceId}` and require a user session, not an API key:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/automations?kind=all&projectId=&ownerId=&limit=20&offset=0` | Paginated union of visible agent automations and readable project workflow rules, plus kind counts |
| POST | `/automations` | Create with `name`, `prompt`, `trigger`, `projectId`, `output`, optional `model`, `enabled`, `dailyRunLimit` |
| GET / PUT / DELETE | `/automations/{automationId}` | Read, replace settings, or delete the automation |
| PATCH | `/automations/{automationId}/enabled` | `{enabled: boolean}`; re-enabling clears pause/failure state and computes a new future slot |
| POST | `/automations/{automationId}/take-over` | Explicit admin takeover; no automatic reassignment |
| POST / GET | `/automations/{automationId}/runs` | Run now (202) or paginated current-owner run history |

Use existing `/conversations/{conversationId}/share` and `/unshare`, `/runs/{runId}`, `/apply`, `/discard`, `/cancel`, and proposal `/undo` endpoints. Ordinary conversation run creation rejects automation conversations, so it cannot bypass automation limits. Workflow rules are read-only in this API; edit them through the project's existing workflow-rule endpoints.

### Automation UI handoff

Fetchers live in `apps/web/src/fetchers/agent-automation/`; one file each exports `getAutomations`, `getAutomation`, `createAutomation`, `updateAutomation`, `deleteAutomation`, `setAutomationEnabled`, `takeOverAutomation`, `runAutomation`, and `getAutomationRuns` through `@kaneo/libs`.

Query hooks are `useAutomations(workspaceId, query?, enabled?)`, `useAutomation(workspaceId, automationId, enabled?)`, and `useAutomationRuns(workspaceId, automationId, paging?, enabled?)`. They poll every 30 seconds; owner run WebSocket updates also invalidate automation queries. Keys come from `automationQueryKeys`. Query paging uses string `limit`/`offset` parameters. List items discriminate `kind: agent | rule`; rule items include project/integration/event/column details.

Mutation hooks are `useCreateAutomation(workspaceId)`, `useUpdateAutomation(workspaceId)`, `useDeleteAutomation(workspaceId)`, `useTakeOverAutomation(workspaceId)`, `useRunAutomation(workspaceId)`, and `useSetAutomationEnabled(workspaceId, automationId)`. Create takes `AutomationInput`; update takes `{automationId, input}`; delete/takeover/run take an automation ID; toggle takes a boolean and optimistically updates detail plus every filtered list with rollback. Disable the toggle while its mutation is pending. All mutation hooks expose standard TanStack loading/error states and invalidate affected data.

Types in `apps/web/src/types/agent-automation.ts` are inferred from the typed API client: `AutomationInput`, `AutomationTrigger`, `AutomationOutput`, `AutomationListQuery`, `AutomationList`, `AutomationListItem`, `AgentAutomationListItem`, `Automation`, and `AutomationRuns`. Use `viewer.isOwner` and `viewer.canTakeOver`; a redacted admin response has `prompt` and `conversationId` null. Sharing uses the existing conversation-sharing mutation, which invalidates automation data too. Inbox notifications use types `agent_automation_digest`/`agent_automation_failed`, resource type `agent_run`, and `eventData.{workspaceId, projectId, automationId, conversationId, runId, url}`. The inbox detail links these to the automation's run page.

### Automation screens

`apps/web/src/components/agent/automation/` implements the pages under the Agent route; there is no separate sidebar item:

- The Agent home lists a few automations with **New** and **View all**.
- `/agent/automations` lists agent automations and read-only project workflow rules (All, Agent, Rules), filterable by project and owner. Rule rows open the project's workflow settings.
- `/agent/automations/new` and `/agent/automations/{id}/edit` hold the form: Schedule or Event trigger, event filters (label, column, and project unless the scope is one project), the mention-aware prompt editor, model, scope, output, and daily run limit. Only the owner reaches the edit page.
- `/agent/automations/{id}?runId=` shows settings, paused or skipped status, run history, and the selected run with the normal proposal review. Owners can toggle, run now, edit, share, and delete. Shared viewers are read-only. Admins with `agent:manage_automations` can take over an automation paused because its owner lost access.

## Verification

Regular integration tests use fake keys and an injected model, and never call OpenRouter. Use a disposable local database ending in `_test`:

```sh
DATABASE_URL=postgresql://localhost:5432/kaneo_agent_backend_test \
  pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts \
  ../../tests/api-integration/agent-proposals.test.ts \
  ../../tests/api-integration/agent-comment-proposals.test.ts \
  ../../tests/api-integration/agent-runner.test.ts \
  ../../tests/api-integration/agent-realtime.test.ts \
  ../../tests/api-integration/agent-attachments.test.ts \
  ../../tests/api-integration/agent-mentions.test.ts \
  ../../tests/api-integration/agent-sharing.test.ts \
  ../../tests/api-integration/agent-sharing-touched-projects.test.ts \
  ../../tests/api-integration/agent-sharing-legacy-runs.test.ts \
  ../../tests/api-integration/agent-sharing-live-access.test.ts \
  ../../tests/api-integration/agent-automations.test.ts \
  ../../tests/api-integration/agent-automation-sharing.test.ts
```

The optional live smoke command calls Luna with synthetic tasks only. It migrates the local test database, creates its own workspace/user, verifies proposal → apply → undo, reports provider usage/cost, and removes its fixtures. It refuses remote databases and models other than Luna:

```sh
DATABASE_URL=postgresql://localhost:5432/kaneo_agent_backend_test \
  KANEO_AGENT_ENABLED=true OPENROUTER_MODEL=openai/gpt-6-luna \
  pnpm --filter @kaneo/api exec tsx scripts/agent-smoke.ts
```

## Phase 1 coding jobs: GitHub repo-ci

Coding jobs are available only for interactive runs and direct task requests in v1. Both digest and proposal-output automations omit coding tools and reject `code.run` at proposal creation and application/job creation. Digest runs remain read-only for every proposal type.

Run detail, conversation history, and recent-run responses include `jobs[]`. Job detail and event history enforce the same current run visibility, including every touched project and the legacy `*` marker, plus access to the job’s project. Run snapshots read jobs within the same repeatable-read transaction as access, steps, and proposals. Job WebSocket updates are owner-only invalidations containing IDs; shared viewers poll under these read rules.

The optional coding backend uses a separate Kaneo Agent App, never an elevated sync App. Configure `KANEO_AGENT_GITHUB_APP_ID`, `KANEO_AGENT_GITHUB_APP_PRIVATE_KEY` (or `_FILE`/`_BASE64`), optional `KANEO_AGENT_GITHUB_APP_SLUG`, `KANEO_CODE_MODEL` (defaults to `OPENROUTER_MODEL`), `KANEO_CODE_JOB_TIMEOUT_MINUTES` (30, range 5–120), and optionally `KANEO_CODE_OIDC_AUDIENCE` (defaults to `KANEO_API_URL`). Missing/invalid App configuration hides new coding jobs without affecting assistant reads or existing job visibility. Already accepted results can finish with the assistant disabled, provided the Agent App remains configured and authorization/entitlement still holds.

Create the Agent App with Contents: write, Pull requests: write, Actions: write, Metadata: read; disable webhooks and omit Workflows permission. Install both Apps on selected repositories. The sync integration must retain its verified repository binding. Opt in with `PATCH /api/github-integration/project/{projectId}` and `{ "codingAgentEnabled": true }`; only `workspace:manage_settings` may do this. Disabling opt-in also blocks commits for pending jobs. The existing linked GitHub account must have write/maintain/admin; `agent:run_code` defaults to owner/admin only. Existing editable role rows are not silently escalated.

Copy [the pinned workflow template](../../../../packages/agent-job/templates/kaneo-agent.yml) to the repository default branch. Set CI variables `KANEO_API_URL` and `KANEO_AGENT_SOURCE_REF` (full reviewed Kaneo commit SHA containing the wrapper), and the customer's own `OPENROUTER_API_KEY` CI secret. A custom OIDC audience must match on both ends. The API needs no coding-model key. Full setup and wrapper constraints are in [the wrapper README](../../../../packages/agent-job/README.md) and [the integration guide](../../../docs/core/integrations/github/coding-agent.mdx).

Starts are explicit: apply `code.run` or `POST /api/agent/{workspaceId}/jobs`. Direct starts create a private project conversation, a completed run, and an applied proposal atomically. UUID request IDs are scoped per workspace/requester. Limits are two active jobs/workspace, one/requester/workspace, ten starts/requester/workspace/hour. PostgreSQL leases coordinate short host operations with at most two operations per poll; assistant model work is not blocked by host operations. No Redis or hosted execution infrastructure is needed.

States: `queued → dispatched → running → committing → completed`, or `failed`/`cancelled`. `completed` has `pr_opened` or `no_changes`; timeout is `failed` with error `timed_out`/`claim_timeout`. Cancel is owner-only and stops before `committing`. Claims verify GitHub RS256/JWKS (cached), issuer, audience, expiry, repository name/ID, workflow run ID, attempt 1, workflow_dispatch, workflow path, and workflow SHA. Callbacks use a per-job hashed credential, bounded bodies, coarse phases, and fixed failure codes. Terminal states remove the hash and gzip changeset bytes. Events/WebSockets carry IDs only; shared readers poll and must still have job-project access.

The upload policy runs again before committing. It refuses base mismatch, default/base-branch writes, CI definitions/local Actions, Git metadata, traversal, and all new symlinks, with 300 files and 10 MiB decoded content maximum. It writes binary-safe Git blobs, a multi-file tree, a deterministic commit, an immutable new ref, and a draft PR. Commit SHA persistence and PR marker/head matching support retry. No default-branch ref update, force push, merge operation, or write credential exists in the job program. `handlePullRequestOpened` links the task and publishes ordinary board events through the sync integration.

Dispatch itself has no transactional idempotency key: recovery scans up to 100 recent matching workflow runs using the template's job-specific run name. A lost response plus delayed visibility can start extra CI, but the stored run ID alone may claim. Commit/PR network steps are bounded; failures after a remote write may require the operator to inspect the recorded branch/run URL. A new job/request ID is the explicit retry action; there is no retry endpoint in this phase. Logs remain in Actions; only coarse phases and a small state history are stored in Kaneo. Workspace budgets, coding cost telemetry, hosted sandbox/local runner, the composer repository chip, the header sandbox status, and an opt-in settings control are deferred.

### Coding UI handoff

The web UI lives in `apps/web/src/components/agent/code/` (job card, pill, code proposal row) and `apps/web/src/components/task/agent-code/` (the task's **Fix with agent** action). Use the existing conversation owner to decide whether to show review/start/cancel controls. Shared viewers have read access only; job reads also depend on all touched projects, not just the job project.

- Types: `AgentRunResponse` is the raw API shape (`proposals[]` includes `code.run`); `getAgentRun`/`useAgentRun` return `AgentRun`, whose `proposals[]` contains task/comment proposals and whose `codeProposals[]` contains `AgentCodeProposal`. Both shapes include `jobs[]`. `AgentRunSummary` and `RecentAgentRun` include jobs too. Other exports in `apps/web/src/types/agent.ts` are `AgentCodeJob`, `AgentCodeRepository`, `AgentCodeStatus`, and `StartAgentCodeJobInput`.
- Availability queries in `hooks/queries/agent/`: `useAgentCodeStatus(workspaceId)` returns `{enabled, canRunCode}`; `useAgentCodeRepositories(workspaceId)` returns opted-in GitHub repositories with `integrationId`, `projectId`, `fullName`, `defaultBranch`, `backend: repo-ci`, and `state: ready | unavailable`.
- Job queries: `useAgentCodeJob(workspaceId, jobId?)` polls every five seconds while active; `useAgentCodeJobEvents(workspaceId, jobId?, after = 0)` fetches up to 100 phase events with an exclusive sequence cursor, without automatic polling. Owner `AGENT_JOB_UPDATED` messages invalidate agent queries. Run details and recent runs continue polling while any job is active, even after the assistant run completes. Shared viewers rely on polling.
- Mutations in `hooks/mutations/agent/`: `useStartAgentCodeJob(workspaceId)` takes `{requestId: UUID, taskId, integrationId, instructions, baseRef?}`; `useCancelAgentCodeJob(workspaceId)` takes a job ID. Both invalidate agent queries and expose normal pending/error states. Matching fetchers live in `fetchers/agent/` and use the typed client and `HttpError`.
- Relative to `/api/agent/{workspaceId}`: `GET /code/status`, `GET /code/repositories`, `POST /jobs` (202), `GET /jobs/{jobId}`, `GET /jobs/{jobId}/events?after=0`, and `POST /jobs/{jobId}/cancel`. Apply code proposals using the existing `POST /runs/{runId}/apply` with selected proposal IDs; applying sets `after.jobId`. Starting from a task creates the same applied proposal audit record.
- Render `queued`, `dispatched`, `running`, `committing`, `completed`, `failed`, and `cancelled`. Completion outcomes are `pr_opened` and `no_changes`; use `prUrl`/`prNumber`, `externalUrl`, `phase`, `progress`, `summary`, and the stable `error` code. Cancellation returns 409 once committing begins; terminal states are final and retry requires a new request ID. Job lifecycle is independent of the assistant run’s review/completion status.
- A code proposal’s `action` is `{type: code.run, taskId, integrationId, instructions, baseRef?}`. Review instructions before apply, then match the resulting `after.jobId` or run `jobs[]`. Code proposals and coding tools are unavailable to both automation output modes in v1.
