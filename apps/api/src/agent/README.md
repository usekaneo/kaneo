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

All paths below are relative to `/api/agent/{workspaceId}`. Use the existing session authentication and the typed `client.agent` from `@kaneo/libs`. Agent endpoints do not accept API keys. Conversations and runs belong to their creator and remain private from other workspace members, including workspace admins. Current permissions and account bans are checked before model execution, before tools, and during review.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/config` | Availability, default `model`, allowed `models` (`{id, label}`), and limits |
| POST | `/conversations` | Create with optional `projectId` and `title`; omitting the project scopes reads to the workspace |
| GET | `/conversations?limit=20&offset=0&projectId=` | Your conversation history, optionally for one project |
| POST | `/conversations/{conversationId}/runs` | Queue `{requestId: UUID, prompt, attachments?, model?}`; returns `{id, status}` with 202 |
| GET | `/conversations/{conversationId}/runs` | Run history, same pagination |
| GET | `/runs?limit=20&offset=0` | Your recent runs across conversations, with pending/applied proposal counts |
| GET | `/runs/{runId}` | Response, status, tool progress, proposals, usage, cost |
| GET | `/runs/{runId}/events` | Authenticated SSE snapshots |
| POST | `/runs/{runId}/cancel` | Cancel queued/running work |
| POST | `/runs/{runId}/apply` | Apply selected `{proposalIds: [...]}` |
| POST | `/runs/{runId}/discard` | Discard selected pending proposals |
| POST | `/proposals/{proposalId}/undo` | Undo an applied task update |
| POST | `/attachments` | Upload `{name, mediaType, data}` (base64 image or PDF); returns `{id, name, mediaType, size}` with 201 |
| GET | `/attachments/{attachmentId}/content` | Your attachment's bytes; images inline, PDFs as downloads |

`attachments` holds up to five items in total. Text files are sent inline as `{name, content}`, at most 50,000 characters each and 100,000 in total; the web client reads them in the browser. Images (PNG, JPEG, WebP, GIF) and PDFs up to 5 MB are first uploaded to `/attachments` and then referenced as `{id}`. Uploads are stored in PostgreSQL in `agent_attachment`, so no object storage is needed; the run itself keeps only `{id, name, mediaType, size}`. Only the uploader can read or reference an upload, each upload can be sent with one run, and at most 20 unsent uploads per user are kept for a day. The runner loads the bytes for the current turn only and sends images and PDFs as AI SDK file parts (OpenRouter parses PDFs for models without native file input); later turns see just the file names. If no provider for the model accepts image input, the run fails with a stable error the client translates. Run responses return attachment metadata, never contents.

Repeating a run request with the same `requestId`, prompt, attachments, and model returns the existing run. Reusing it with a different prompt, attachments, or model returns 409. Each conversation has at most one active run; each user has at most two active runs and ten new runs per minute. Selected proposal IDs must be distinct, with at most twenty per request.

SSE emits `run` events containing the same JSON as GET run details, then `done` when the run finishes or reaches `awaiting_review`. Connections close after two minutes; fetch the run and reconnect if it remains active. Use credentialed `fetch` for separately hosted API/web deployments or the existing API URL helper. Run updates also send private `AGENT_RUN_UPDATED` messages through the existing user WebSocket, containing only `workspaceId` and `runId`; refetch details after receiving them.

## UI handoff

1. Create a conversation scoped to the board project, or to the workspace for the standalone Agent page.
2. Queue a run with a new UUID and render response/progress from persisted snapshots. Render Markdown through Kaneo's existing sanitization path; model text and task descriptions are untrusted.
3. At `awaiting_review`, render pending proposals as overlays. `action` is the proposed patch/creation, `reason` explains it, and `before` is the server's task snapshot. `after` remains null until applied. Never change board cache values just because a proposal exists.
4. Submit only checked proposal IDs to `/apply`. The response contains per-proposal `applied` or `failed` results; conflicts are HTTP 409 codes inside those results. Refetch run details to keep pending selections accurate. Apply is independent per proposal, so some can succeed while others conflict.
5. Applied updates can be undone if their affected fields still equal the applied values. Unrelated teammate edits are preserved. Created tasks use the normal task deletion workflow rather than automatic undo.

Actual task changes publish the existing task events, which produce normal board WebSocket messages and existing cache refreshes. The applying tab also receives these messages because the durable effect is delivered outside the original request's initiator context.

## Web UI

`apps/web/src/components/agent/` implements both surfaces. Project views get an **Agent** button (⌘/Ctrl+J) that opens a side panel scoped to the project; pending task updates from the latest run are previewed on matching board cards through `store/agent-panel.ts`. The sidebar's **Agent** page starts workspace-scoped conversations and lists recent runs. Both are hidden when `/config` reports the agent disabled or the user is anonymous. Run details refresh from `AGENT_RUN_UPDATED` on the user WebSocket, with slow polling only while a run is active; the UI does not use the SSE endpoint.

## Scope and guarantees

Tools list projects, members, bounded task pages, task details with recent comments/stored links, and workload counts. Task pages deliberately have no text/status/assignee filters so smaller models do not accidentally exclude the task they need. Workspace-wide inspection uses pagination. Counts describe observed tasks, not a person's capacity or skills; stored links do not establish live PR reviews or CI state.

Supported proposals are task creation and updates to title, priority, assignee, and due date. Validation uses current workspace permissions, member assignment rules, project columns, required custom fields, and date constraints. The API owns the before snapshot. Applying and undoing compare affected fields and project ownership under database locks. The mutation, receipt, and outbox insertion commit together; retries do not duplicate task creation or replay mutations.

The outbox dispatches normal events after commit, in proposal order. A process crash can cause event redispatch; delivery is at least once, and downstream handlers retain their existing delivery semantics. It is not an exactly-once guarantee for notifications or integrations. Expired runs fail and discard pending proposals; model calls are not automatically retried after a crash. Cancellation aborts in-flight work when the worker observes it; provider work already performed can still be billed.

Automation rules/schedules, task attachments, subtasks, labels, comments as writes, status changes, and live GitHub queries are follow-up features. The initial implementation has no arbitrary HTTP, SQL, shell, or integration-secret tool. Run history is durable without automatic retention pruning; there is currently no conversation deletion endpoint.

## Verification

Regular integration tests use fake keys and an injected model, and never call OpenRouter. Use a disposable local database ending in `_test`:

```sh
DATABASE_URL=postgresql://localhost:5432/kaneo_agent_backend_test \
  pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts \
  ../../tests/api-integration/agent-proposals.test.ts \
  ../../tests/api-integration/agent-runner.test.ts \
  ../../tests/api-integration/agent-realtime.test.ts \
  ../../tests/api-integration/agent-attachments.test.ts
```

The optional live smoke command calls Luna with synthetic tasks only. It migrates the local test database, creates its own workspace/user, verifies proposal → apply → undo, reports provider usage/cost, and removes its fixtures. It refuses remote databases and models other than Luna:

```sh
DATABASE_URL=postgresql://localhost:5432/kaneo_agent_backend_test \
  KANEO_AGENT_ENABLED=true OPENROUTER_MODEL=openai/gpt-6-luna \
  pnpm --filter @kaneo/api exec tsx scripts/agent-smoke.ts
```
