# Agent backend

The assistant uses the AI SDK with OpenRouter. It reads Kaneo through scoped tools and stores concrete proposals. Applying a proposal is a separate authenticated domain operation and does not call a model. The API worker runs in the same process; PostgreSQL provides the queue, run leases, receipts, and mutation outbox. Redis remains optional.

## Configuration

Set server configuration in the root `.env`:

```dotenv
KANEO_AGENT_ENABLED=true
OPENROUTER_API_KEY=your-key
OPENROUTER_MODEL=openai/gpt-6-luna
```

The key also supports `OPENROUTER_API_KEY_FILE`. Credentials are never returned by the agent API. The feature is disabled unless explicitly enabled with valid configuration. Existing history, cancellation, review, and undo remain available if model access is disabled.

| Setting | Default | Allowed values |
| --- | --- | --- |
| `OPENROUTER_MODEL` | `openai/gpt-6-luna` | OpenRouter model ID with tool support |
| `OPENROUTER_MODELS` | unset | Comma-separated model IDs users may pick per run, up to 20 including the default |
| `KANEO_AGENT_MAX_STEPS` | 8 | 1–12 model steps |
| `KANEO_AGENT_MAX_OUTPUT_TOKENS` | 2048 | 256–4096 per step |
| `KANEO_AGENT_TIMEOUT_MS` | 120000 | 10000–300000 |
| `KANEO_AGENT_CONCURRENCY` | 1 | 1–4 runs per API process |
| `OPENROUTER_ZDR` | false | `true` restricts inference to ZDR endpoints |

`OPENROUTER_MODEL` is the default and is always allowed. When `OPENROUTER_MODELS` lists other models, the composer shows a model picker and runs may request any listed model; the API rejects others with 400. Invalid entries disable the agent, like other invalid settings.

The provider must support requested parameters; OpenRouter routing disallows provider data collection. Workspace context is still sent to OpenRouter. Runs record token usage and the provider-reported `costUsd`, which can be null if unavailable. These limits bound work, but do not constitute a dollar budget. Enforce account spending limits in OpenRouter, especially when selecting a more expensive model.

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

`attachments` holds up to five items in total. Text files are sent inline as `{name, content}`, at most 50,000 characters each and 100,000 in total; the web client reads them in the browser. Images (PNG, JPEG, WebP, GIF) and PDFs up to 5 MB are first uploaded to `/attachments` and then referenced as `{id}`. Uploads are stored in PostgreSQL in `agent_attachment`, so no object storage is needed; the run itself keeps only `{id, name, mediaType, size}`. Only the uploader can reference an upload, and only the uploader or a viewer of the shared conversation it was sent in can read it. Each upload can be sent with one run, and at most 20 unsent uploads per user are kept for a day. The runner loads the bytes for the current turn only and sends images and PDFs as AI SDK file parts (OpenRouter parses PDFs for models without native file input); later turns see just the file names. If no provider for the model accepts image input, the run fails with a stable error the client translates. Run responses return attachment metadata, never contents.

The composer's @-mentions are written into the prompt as `@[Launch v3](project:ID)` or `@[WEB-135 Fix login](task:ID)`, at most ten distinct items per prompt. `mentions` lists the same `{type, id}` references and must match the prompt's tokens; there is no separate column. When the run executes, the runner resolves each reference with the user's current project access and the conversation's project scope, and appends a `<mentioned_items>` block (title, key, status, project) to that turn as untrusted data. Items the user cannot access are dropped silently. Later turns keep only the prompt text.

Repeating a run request with the same `requestId`, prompt, attachments, and model returns the existing run. Reusing it with a different prompt, attachments, or model returns 409. Each conversation has at most one active run; each user has at most two active runs and ten new runs per minute. Selected proposal IDs must be distinct, with at most twenty per request.

SSE emits `run` events containing the same JSON as GET run details, then `done` when the run finishes or reaches `awaiting_review`. Connections close after two minutes; fetch the run and reconnect if it remains active. Use credentialed `fetch` for separately hosted API/web deployments or the existing API URL helper. Run updates also send private `AGENT_RUN_UPDATED` messages to the owner through the existing user WebSocket, containing only `workspaceId` and `runId`; refetch details after receiving them. Shared viewers do not receive these messages (see [Sharing](#sharing)).

## Sharing

Conversations are private by default. The owner can share a conversation with `POST /share`; sharing covers the whole thread, including runs started later, and `agent_conversation.shared_at` records it. `POST /unshare` clears it, and access ends on the next request.

While a conversation is shared, any current workspace member with `project:read` and `task:read` can view it if they can read its project under the normal project access rules (instance admins included). A workspace-scoped conversation is visible to every such member, so tool results from any project the owner could read become visible to them; the owner decides this by sharing. Viewers can read runs, steps, proposals, responses, and attachments, but only the owner can queue runs, cancel, apply, discard, undo, or change sharing. Viewers get 403 for those actions. Anyone else gets 404 for every agent endpoint of a private conversation, so its existence stays hidden. Shared attachment responses are sent with `Cache-Control: private, no-store`, so unsharing is not bypassed by a browser cache.

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

Automation rules/schedules, task attachments, subtasks, labels, status changes, and live GitHub queries are follow-up features. The initial implementation has no arbitrary HTTP, SQL, shell, or integration-secret tool. Run history is durable without automatic retention pruning; there is currently no conversation deletion endpoint.

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
  ../../tests/api-integration/agent-sharing.test.ts
```

The optional live smoke command calls Luna with synthetic tasks only. It migrates the local test database, creates its own workspace/user, verifies proposal → apply → undo, reports provider usage/cost, and removes its fixtures. It refuses remote databases and models other than Luna:

```sh
DATABASE_URL=postgresql://localhost:5432/kaneo_agent_backend_test \
  KANEO_AGENT_ENABLED=true OPENROUTER_MODEL=openai/gpt-6-luna \
  pnpm --filter @kaneo/api exec tsx scripts/agent-smoke.ts
```

## Phase 1 coding jobs: GitHub repo-ci

The optional coding backend uses a separate Kaneo Agent App, never an elevated sync App. Configure `KANEO_AGENT_GITHUB_APP_ID`, `KANEO_AGENT_GITHUB_APP_PRIVATE_KEY` (or `_FILE`/`_BASE64`), optional `KANEO_AGENT_GITHUB_APP_SLUG`, `KANEO_CODE_MODEL` (defaults to `OPENROUTER_MODEL`), `KANEO_CODE_JOB_TIMEOUT_MINUTES` (30, range 5–120), and optionally `KANEO_CODE_OIDC_AUDIENCE` (defaults to `KANEO_API_URL`). Missing/invalid App configuration hides new coding jobs without affecting assistant reads or existing job visibility. Already accepted results can finish with the assistant disabled, provided the Agent App remains configured and authorization/entitlement still holds.

Create the Agent App with Contents: write, Pull requests: write, Actions: write, Metadata: read; disable webhooks and omit Workflows permission. Install both Apps on selected repositories. The sync integration must retain its verified repository binding. Opt in with `PATCH /api/github-integration/project/{projectId}` and `{ "codingAgentEnabled": true }`; only `workspace:manage_settings` may do this. Disabling opt-in also blocks commits for pending jobs. The existing linked GitHub account must have write/maintain/admin; `agent:run_code` defaults to owner/admin only. Existing editable role rows are not silently escalated.

Copy [the pinned workflow template](../../../../packages/agent-job/templates/kaneo-agent.yml) to the repository default branch. Set CI variables `KANEO_API_URL` and `KANEO_AGENT_SOURCE_REF` (full reviewed Kaneo commit SHA containing the wrapper), and the customer's own `OPENROUTER_API_KEY` CI secret. A custom OIDC audience must match on both ends. The API needs no coding-model key. Full setup and wrapper constraints are in [the wrapper README](../../../../packages/agent-job/README.md) and [the integration guide](../../../docs/core/integrations/github/coding-agent.mdx).

Starts are explicit: apply `code.run` or `POST /api/agent/{workspaceId}/jobs`. Direct starts create a private project conversation, a completed run, and an applied proposal atomically. UUID request IDs are scoped per workspace/requester. Limits are two active jobs/workspace, one/requester/workspace, ten starts/requester/workspace/hour. PostgreSQL leases coordinate short host operations with at most two operations per poll; assistant model work is not blocked by host operations. No Redis or hosted execution infrastructure is needed.

States: `queued → dispatched → running → committing → completed`, or `failed`/`cancelled`. `completed` has `pr_opened` or `no_changes`; timeout is `failed` with error `timed_out`/`claim_timeout`. Cancel is owner-only and stops before `committing`. Claims verify GitHub RS256/JWKS (cached), issuer, audience, expiry, repository name/ID, workflow run ID, attempt 1, workflow_dispatch, workflow path, and workflow SHA. Callbacks use a per-job hashed credential, bounded bodies, coarse phases, and fixed failure codes. Terminal states remove the hash and gzip changeset bytes. Events/WebSockets carry IDs only; shared readers poll and must still have job-project access.

The upload policy runs again before committing. It refuses base mismatch, default/base-branch writes, CI definitions/local Actions, Git metadata, traversal, and all new symlinks, with 300 files and 10 MiB decoded content maximum. It writes binary-safe Git blobs, a multi-file tree, a deterministic commit, an immutable new ref, and a draft PR. Commit SHA persistence and PR marker/head matching support retry. No default-branch ref update, force push, merge operation, or write credential exists in the job program. `handlePullRequestOpened` links the task and publishes ordinary board events through the sync integration.

Dispatch itself has no transactional idempotency key: recovery scans up to 100 recent matching workflow runs using the template's job-specific run name. A lost response plus delayed visibility can start extra CI, but the stored run ID alone may claim. Commit/PR network steps are bounded; failures after a remote write may require the operator to inspect the recorded branch/run URL. A new job/request ID is the explicit retry action; there is no retry endpoint in this phase. Logs remain in Actions; only coarse phases and a small state history are stored in Kaneo. Workspace budgets, coding cost telemetry, hosted sandbox/local runner, and visual web UI are deferred.
