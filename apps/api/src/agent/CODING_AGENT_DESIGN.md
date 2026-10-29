# Coding agent: design

Status: phase 1 backend, web data layer, and web UI (task action, run thread job card, recent-runs pill) implemented, 2026-10-28. The composer repository chip, header sandbox status, and later execution backends remain planned. The implementation contract and setup are in [README.md](README.md#phase-1-coding-jobs-github-repo-ci); the remaining sections describe the broader target design.

## Decisions (maintainer, binding)

- Use a separate optional Kaneo Agent GitHub App with Contents: write, Pull requests: write, Actions: write, Metadata: read. The existing integration App receives no permission increase. Use `KANEO_AGENT_GITHUB_APP_ID`, private key (including `_FILE`/`_BASE64`), and optional slug; hide starts unless configured.
- `agent:run_code` belongs to owner/admin defaults only. Recheck linked GitHub write/maintain/admin access, project access, opt-in, active integration, repository identity, and entitlement before dispatch and commit.
- PRs are drafts. Never merge, force-push, or write the default/base branch. Workflow and local Action changes are always refused; there is no policy override. Phase 1 rejects all newly written symlinks to avoid indirect escapes through existing links.
- A target repository must be connected to the task project through the verified sync integration and installed for the separate Agent App. Opt-in is `PATCH /github-integration/project/{projectId}` with `codingAgentEnabled`, behind `workspace:manage_settings`.
- Cloud and self-hosted phase 1 run only `repo-ci` on GitHub. The customer's model key is a CI secret. Kaneo runs no customer code and holds no coding-model key.
- Jobs belong to runs/conversations, private by default and shareable under existing visibility rules. Reads additionally check job project access; cancel remains owner-only.
- This implementation excludes React components, pages, styling, i18n UI copy, and Paper design work. Web fetchers/hooks, proposal types, and realtime invalidation are included for the UI handoff.

### Phase 1 implementation differences

- The persisted lifecycle uses `dispatched` instead of `starting`; deadlines/claim/heartbeat expiry are `failed` plus a stable error, rather than a separate `timed_out` state. Cancel stops before `committing` so it cannot race repository writes.
- New tables are `agent_job`, `agent_job_changeset`, and `agent_job_event`. There is no budget/settings table, coding cost estimate, log storage, runner table, or unused backend abstraction. Latest progress is a coarse phase; state history stays small. Bodies cap changesets at 300 files/10 MiB decoded bytes, binary-safe base64 plus gzip at rest.
- All job callbacks are mounted publicly at `/api/agent-jobs`, bounded and authenticated by OIDC or a single-job credential, independent of session auth. Claims additionally bind workflow path/SHA, event, and first attempt. Callback credentials never enter the coding process environment.
- Coding PR linking uses the stored job task/integration when branch, repository ID, and commit SHA match. This avoids ambiguous generic matching across connected projects and supports tasks without numbers; ordinary PR matching is unchanged.
- Run/list responses expose `jobs[]` because a run may approve multiple coding proposals. The web run fetcher exposes `codeProposals` separately so existing task-proposal renderers stay compatible while the new UI is built. `/code/status` exposes `{enabled,canRunCode}`; `/code/repositories` supplies per-repository readiness. `GET /jobs/{jobId}` supplies job status, and `GET /jobs/{jobId}/events?after=` supplies state history.
- A new request ID is the explicit retry operation; no retry endpoint. Dispatch recovery scans recent matching run names, with a documented ambiguity window after a lost dispatch response. API commit retries use deterministic commits, SHA-checked refs, and PR head/marker matching; remote GitHub calls cannot be atomic with PostgreSQL.
- Ship a complete source-pinned workflow template in `packages/agent-job/templates`; it builds this package from a reviewed full Kaneo commit SHA. No separate action repository or npm publication is assumed. OpenCode 1.19.5 and platform packages have lockfile integrity pins. Shell/network tools, external plugins, and repository configuration are disabled for this first restrictive adapter.
- Fixed start limits: 2 active/workspace, 1 active/requester/workspace, 10 starts/requester/workspace/hour; 30-minute default deadline (5–120 configurable); at most 2 host operations per process poll with 5-minute leases and 2-minute network-operation bounds. Editable existing admin role rows are preserved; owners can grant the new permission explicitly.


The assistant in this directory reads Kaneo and stores proposals. This design adds **coding jobs**: a coding agent edits a repository linked to a project and opens a pull request. The design keeps the assistant's main guarantee. The model cannot cause a durable change unless a person approves it, and the change goes through an authenticated domain operation. For code, the reviewable change is the pull request.

## 1. Target architecture

1. **One execution interface, three backends.** `repo-ci` runs the job in the customer's own CI. `hosted-sandbox` runs it in a microVM provider; E2B comes first. `local-runner` is an optional container that self-hosters run, which pulls jobs. The backends differ only in where the job runs and how it receives its job spec.
2. **One job program for all backends.** `kaneo-agent-job` is a small Node wrapper around a pinned open-source headless coding CLI. It is published as an OCI image, a GitHub/Gitea composite action, and a GitLab CI component. It claims a job, checks out code, runs the CLI, reports progress, and uploads a **changeset**.
3. **No repository write credential enters untrusted execution.** The job returns a changeset: file operations, a commit message, and a PR title and body. Kaneo checks it against policy. Kaneo then commits it to a new branch that it names itself and opens the PR through the integration credential the API already holds. The rule "never push to the default branch or merge" is therefore structural, not just a prompt instruction. It also means:
   - PRs are authored by the Kaneo App, so the repository's normal PR CI runs. PRs created with `GITHUB_TOKEN` do not trigger workflows.
   - CI files can be refused.
   - Diff size is bounded.
4. **Starting a job always takes an explicit human step.** There are two ways in:
   - The assistant saves a `code.run` proposal, which the user applies.
   - The user starts a job directly from a task. This creates the same run and proposal records, already applied, so history, sharing, and audit have one shape.

   Every start checks workspace permission, repository opt-in, and, on GitHub, the requester's own write access to the repository.
5. **Credentials are per job and short-lived.** Kaneo verifies each job with a per-job bearer credential, stored as a SHA-256 hash. In CI it is obtained by exchanging an OIDC token, not passed as a workflow input. The model key depends on the backend:
   - `repo-ci`: the customer's own CI secret.
   - `hosted-sandbox` and `local-runner`: a per-job OpenRouter key, created through the management API with a dollar `limit` and deleted when the job ends. Where the provider supports it, the key is injected at the sandbox egress proxy so it never exists inside the VM.
6. **Kaneo Cloud:** `repo-ci` and `hosted-sandbox` only, on Kaneo's E2B account. `local-runner` is not offered, and its endpoints are not mounted.
7. **Phase 1** is `repo-ci` for GitHub, end to end.

## 2. User flow

### Starting a job

- **From the assistant.** The user asks something like "Fix WEB-135 and open a pull request". The model reads the task with the existing tools and calls a new tool, `propose_code_job`. It saves a `code.run` proposal holding the task, the repository, written instructions, and a base branch. The proposal card shows:
  - repository and base branch, and the branch the job will create;
  - backend, model, time limit, and budget;
  - the instructions, rendered as untrusted Markdown.

  **Apply** starts the job. **Discard** drops it. The "Ask before changes" chip has no effect on code: a `code.run` proposal is never auto-applied.
- **From a task.** A new task action, "Start coding agent", is available on task detail and in the card menu. It opens a dialog that is prefilled with the repository from the project's integration and with instructions drafted from the task title and description. The user can edit both. Submitting calls `POST /api/agent/{ws}/jobs`. No model step runs before the job.
- **Repository chip in the composer.** The chip (`usekaneo/kaneo ▾`) sets the conversation's default repository. In the project panel it defaults to that project's code-enabled integration. The model can only propose jobs for repositories the chip's endpoint lists.

### What the user sees

- **The run thread** shows a job card. The card has:
  - a phase stepper: Queued → Starting → Working → Opening PR → Done;
  - elapsed time and cost;
  - the latest progress line, such as "Running `pnpm test`" or "Edited 4 files";
  - **Cancel**, **Logs**, and **Open PR**.

  Logs link to the CI run for `repo-ci`. For the other backends they show a redacted tail stored by Kaneo, rendered as plain text.
- **Recent runs row**, for example "Fix WebSocket reconnect loop (WEB-135)":
  - The row is an `agent_run` with an attached `agent_job`. The `<>` icon marks a run that has a job.
  - The pill comes from `agent_job`: "PR #1874 opened" means `status=completed, outcome=pr_opened, prNumber`. Other pills: "Working…", "No changes", "Failed", "Cancelled".
  - The avatar is the requester. "Everyone in Northwind Labs" lists runs shared with the workspace; runs are private by default.
- **Sandbox button in the header.** It shows whether this workspace can run code, plus your active jobs.
  - Dot colors:
    - green: at least one backend is ready for some enabled repository;
    - amber: degraded, for example GitHub App permissions awaiting approval, the workflow file missing, all runners offline, or the budget nearly used;
    - grey: no backend configured.
  - The popover lists active jobs, which can be cancelled. Admins also get a link to backend settings.
  - Backed by `GET /api/agent/{ws}/code/status`.
- **Code examples column**: static i18n prompts, like the existing `agent-examples.tsx` groups. The column is hidden when `/code/status` reports `unavailable`.

### Cancel and retry

- **Cancel** marks the job `cancelled` and clears the credential hash, so any later callback gets 410. It then calls `backend.cancel()` as best effort:
  - `repo-ci`: cancel the workflow run;
  - `hosted-sandbox`: kill the sandbox;
  - `local-runner`: the runner kills the container on its next heartbeat.

  A changeset that arrives after cancellation is rejected. Model spend that already happened is still billed, as the README says for runs.
- **Retry** creates a new job with the same spec (`retryOfJobId`, new `requestId`). A model-driven job is never retried automatically. Only Kaneo's own idempotent steps retry: dispatch, and commit-and-PR.

### PR ↔ task link

- **Branch name.** `generateBranchName(config.branchPattern, slug, number, title)` (`plugins/github/utils/branch-matcher.ts`), followed by a `-kaneo-{6 chars of jobId}` suffix, for example `web-135-kaneo-x7k2qa`. `createBranchRegex` accepts a trailing `-…`, so the existing matcher still finds the task. A `kaneo/` prefix would not match, because the regex is anchored with `^`.
- **PR title** starts with the task key, for example `WEB-135: Fix WebSocket reconnect loop`. That is the fallback for integrations that use `customBranchRegex`. The PR body ends with the Kaneo task URL and the job's summary.
- `handlePullRequestOpened` (`plugins/github/webhooks/pull-request-opened.ts`) → `resolvePullRequestTask` then links the PR as an `external_link` and applies `statusTransitions.onPROpen` exactly as for a human PR. The Gitea and GitLab handlers do the same.
- In case webhooks are misconfigured, the commit step also calls the same `createExternalLink` guarded by `findExternalLink`, inside `withIntegrationTask`. A webhook that arrives later is a no-op because of its `existingLink` check.

## 3. Backend interface

```ts
// apps/api/src/agent/code/backend.ts
export type CodeBackendKind = "repo-ci" | "hosted-sandbox" | "local-runner";

export type CodeJobLaunch = {
  jobId: string;
  repository: CodeRepository;      // host, integrationId, owner/name or projectPath, repoId, baseRef, baseSha
  deadline: Date;
  // Present only for backends Kaneo starts directly; never logged or persisted.
  credentials?: { jobToken: string; modelKey?: string; readToken?: string };
};

export type CodeBackendAvailability =
  | { state: "ready" }
  | { state: "degraded" | "unavailable"; reason: CodeBackendReason }; // stable codes, translated in web

export interface CodeBackend {
  kind: CodeBackendKind;
  availability(repo: CodeRepository): Promise<CodeBackendAvailability>;
  // Idempotent per jobId. Returns provider references, never secrets.
  start(job: CodeJobLaunch, signal: AbortSignal): Promise<{ externalRef: string | null; externalUrl: string | null }>;
  cancel(job: CodeJobRecord): Promise<void>;                    // best effort
  // Reconciliation when callbacks stop: detects a CI run that failed before claiming, a killed sandbox, and so on.
  observe(job: CodeJobRecord): Promise<"running" | "gone" | "unknown">;
}
```

- **Progress, logs, and results do not go through the backend.** The job program reports them through one callback API (§3.4) on every backend. Without that, there would be three progress protocols to maintain.
- For `local-runner`, `start()` does nothing; the job stays `queued` until a runner claims it.

### 3.1 Lifecycle

```
queued ──start()──▶ starting ──claim──▶ running ──changeset──▶ committing ──▶ completed{pr_opened|no_changes}
   │                   │                  │                        │
   └───────────────────┴──────────────────┴────────────────────────┴──▶ failed{code} | cancelled | timed_out
```

- **`queued`**: the job row is created in the same transaction that applies the proposal, together with the proposal's `after = {jobId}`.
- **`starting`**: the worker claimed the job under a lease and called `start()`. This state times out after 10 min without a claim, which catches a missing workflow file, no runner online, or a provider error.
- **`running`**: the job program exchanged its claim for a job credential. It must heartbeat at least every 30 s; the heartbeat response carries `cancelRequested`. Five minutes without a heartbeat, or passing `deadline`, leads to `timed_out` and `cancel()`.
- **`committing`**: the changeset is stored. The worker validates it, creates the branch and commit, opens the PR, and links the task. This step is idempotent: a deterministic branch name plus the stored `commitSha` and `prNumber`. Kaneo retries it on transient host errors.
- **Terminal states** clear the credential hash, delete the per-job model key and any read token, and delete the changeset bytes.

### 3.2 Tables (Drizzle, `apps/api/src/database/schema.ts`)

These follow the `agent_run` patterns: `createId()` text ids, `utcNow`, text enums, lease columns, and cascade on the parent.

```ts
agent_job: {
  id, runId → agent_run (cascade, not null), proposalId → agent_proposal (unique, set null),
  workspaceId → workspace (cascade), projectId → project (cascade), taskId → task (set null),
  userId → user (cascade)            // requester; jobs act for this user
  integrationId → integration (cascade),
  requestId (unique per workspace+user), retryOfJobId,
  backend: "repo-ci" | "hosted-sandbox" | "local-runner",
  status: "queued" | "starting" | "running" | "committing" | "completed" | "failed" | "cancelled" | "timed_out",
  outcome: "pr_opened" | "no_changes" | null,
  phase: text | null,                // last coarse phase for list rows
  instructions: text (≤ 8000), model: text, baseRef, baseSha, branch,
  externalRef, externalUrl,          // workflow run id/URL, sandbox id, runner container id
  runnerId → agent_runner (set null),
  credentialHash, claimHash, credentialExpiresAt,   // SHA-256; raw values never stored
  modelKeyHash,                      // OpenRouter key hash, used for DELETE; not the key
  commitSha, prNumber, prUrl, summary (≤ 4000, untrusted),
  costUsd, budgetUsd, error (stable code),
  leaseOwner, leaseExpiresAt, heartbeatAt, deadline,
  createdAt, startedAt, finishedAt,
} // indexes: (status, createdAt) queue; (workspaceId, userId, createdAt); (runId)

agent_job_event: { id, jobId → agent_job (cascade), sequence serial, kind: "phase" | "progress" | "log",
                   message text (≤ 500, ≤ 2000 for log chunks), createdAt }
                 // Capped at 500 rows / 256 KB per job; the oldest log rows are dropped first.

agent_job_changeset: { jobId PK → agent_job (cascade), data bytea (≤ 20 MB, gzip JSON), createdAt }
                 // Like agent_attachment: bytes are kept out of agent_job so list and detail queries never load them.

agent_runner: { id, name, tokenHash, labels jsonb, createdByUserId, lastSeenAt, disabledAt, createdAt }
                 // local-runner only; instance-scoped. See §7.
```

- **Per-repository settings** go in the existing integration `config` JSON, not a new table. Add `codingAgent?: { enabled, backend?, allowCiFileChanges? }` to `githubConfigSchema`, `giteaConfigSchema`, and `gitlabConfigSchema`. Only users with `workspace:manage_settings` can enable it.
- **The per-workspace budget** (monthly USD and maximum active jobs) is a new small `agent_code_setting` row. Its absence means instance defaults apply.
- **Sharing:** jobs are private, like runs. The planned sharing flag on `agent_conversation` (private by default, shareable with the workspace) also covers jobs. Every read endpoint resolves job → run → conversation and reuses `getOwnedRun`, extended for shared visibility. Cancel stays owner-only.

### 3.3 Worker integration

`processAgentQueue()` in `worker.ts` gets a sibling call, `processCodeJobs()`, alongside `failExpiredRuns()` and `deliverAgentEffects()`, on the same 1 s tick and shutdown signal. On each tick it:

1. Expires jobs. This is `failExpiredCodeJobs()`: deadline or heartbeat passed → `timed_out`, plus `cancel()` and credential cleanup.
2. Claims `queued` jobs for `repo-ci` and `hosted-sandbox`. It uses `select … for update skip locked`, the same as the run claim, then sets `starting` with a lease of 60 s and calls `start()`. A start in progress must never be the only copy of state: `start()` is idempotent per `jobId`.
   - `repo-ci` looks for an existing run before dispatching again.
   - E2B tags the sandbox with `jobId` metadata.
3. Claims `committing` jobs and runs the commit-and-PR step under a lease. This step uses the network but not a model, so it may run with the agent disabled for model access. Like the README's "review remains available", committing an already-produced changeset is allowed.
4. Every 60 s, for `starting` and `running` jobs with stale heartbeats, calls `observe()`. `gone` → `failed{runner_lost}`.

- `KANEO_CODE_CONCURRENCY` limits concurrent `start()` and commit steps in each process. The default is 2. It is separate from `KANEO_AGENT_CONCURRENCY`.
- Jobs execute outside the API, so the API holds no long-lived work.

### 3.4 Job callback API

These routes are mounted at `/api/agent-jobs/*`. They accept no session and no API key.

| Method | Path | Auth | Purpose |
| --- | --- | --- | --- |
| POST | `/claim` | OIDC JWT (GitHub, GitLab), claim code (Gitea), or a token Kaneo injected (sandbox, runner) | Exchange for a job credential; returns the job spec |
| POST | `/{jobId}/heartbeat` | job credential | `{phase?, progress?}` → `{cancelRequested}` |
| POST | `/{jobId}/logs` | job credential | Append a redacted log chunk (sandbox and runner only) |
| POST | `/{jobId}/changeset` | job credential | Upload the result, or `{outcome:"no_changes", summary}`; moves the job to `committing`; single use |
| POST | `/{jobId}/fail` | job credential | `{code}` from a fixed enum |

- **The job spec** contains the instructions, base SHA, branch name, model, deadline, and a bounded task context block, which is the same data `readTask` gives the assistant. All of it is marked untrusted.
- **Bodies are bounded** with `bounded-request-body.ts` and validated with Zod. This is a public surface, so it is described in OpenAPI.
- **Rate limits:** per job, and per IP for `/claim`.

**Realtime.**
- Each state change and each throttled progress update (at most one every 2 s) sends `broadcastToUser(job.userId, { type: "AGENT_JOB_UPDATED", workspaceId, runId, jobId })`. The payload has ids only, like `AGENT_RUN_UPDATED`, and the web refetches `GET /runs/{runId}`, which embeds the job summary.
- People viewing a shared run use the existing slow polling while the job is active.
- Delivery uses the existing broadcast adapter, so Redis stays optional.
- When the PR is linked, the normal `task.updated` and `task.status_changed` events update boards.

### 3.5 HTTP for the web

These are added under `/api/agent/{workspaceId}` and use the same `requireAgentSession`.

- `GET /code/status`: drives the Sandbox button.
- `GET /code/repositories`: drives the repo chip. Returns code-enabled integrations in projects you can access: `{integrationId, host, fullName, defaultBranch, backend, state}`.
- `POST /jobs`: direct start from a task. Takes `{requestId, taskId, integrationId, instructions, baseRef?}`.
- `GET /jobs/{jobId}/events?after=`: events and log tail.
- `POST /jobs/{jobId}/cancel` and `POST /jobs/{jobId}/retry`.
- `GET /runs/{runId}` and `/runs` add `job: {id, status, outcome, phase, prNumber, prUrl, externalUrl, costUsd}`.

For the client, add `@kaneo/libs` client types and run `pnpm openapi:check:fix`.

### 3.6 Configuration

Configuration lives in the root `.env`, following `config.ts`. Invalid values disable coding jobs without disabling the assistant.

| Setting | Default | Notes |
| --- | --- | --- |
| `KANEO_CODE_ENABLED` | `false` | Requires `KANEO_AGENT_ENABLED` |
| `KANEO_CODE_BACKENDS` | `repo-ci` | Instance allowlist, comma-separated. If `local-runner` is set while `KANEO_CLOUD=true`, coding jobs are disabled and the API logs a startup error |
| `KANEO_CODE_MODEL` / `KANEO_CODE_MODELS` | `OPENROUTER_MODEL` | Coding models, parsed with `parseAgentModels` |
| `KANEO_CODE_JOB_TIMEOUT_MINUTES` | 30 | Range 5–120 |
| `KANEO_CODE_JOB_BUDGET_USD` | 2 | Per-job OpenRouter key `limit` (sandbox and runner) |
| `KANEO_CODE_MAX_ACTIVE_JOBS` | 2 per workspace, 1 per user | |
| `KANEO_CODE_CONCURRENCY` | 2 | Range 1–8 per process |
| `OPENROUTER_MANAGEMENT_KEY(_FILE)` | unset | Needed for sandbox and runner jobs to use Kaneo-paid models |
| `E2B_API_KEY(_FILE)`, `E2B_TEMPLATE`, `E2B_API_URL` | unset | `E2B_API_URL` is for self-hosted E2B |
| `KANEO_CODE_SANDBOX_ALLOW_DOMAINS` | unset | Extra egress domains, such as a private registry |
| `KANEO_CODE_OIDC_AUDIENCE` | `KANEO_API_URL` | Expected `aud` of the CI OIDC token |

- **Cloud** sets `KANEO_CODE_BACKENDS=repo-ci,hosted-sandbox` and uses its own E2B and management keys.
- `requireWorkspaceEntitlement()` runs at proposal creation, apply, start, and commit.
- Billing limits jobs per plan with `budgetUsd` and the workspace monthly cap, which is enforced at start against the sum of `costUsd`.
- **Self-hosters** may enter their own E2B key in workspace settings. It is stored with `encryptSecret()` (`notification-preferences/secrets.ts`) and requires `NOTIFICATION_SECRET_ENCRYPTION_KEY`. This works the same on Cloud, so it is not Cloud-specific.

## 4. Credentials

| Credential | Who holds it | Scope and lifetime | How it reaches the job |
| --- | --- | --- | --- |
| Job credential | Job program | One job; expires at `deadline`; revoked on terminal state | Returned by `/claim`. CI masks it with `::add-mask::`. Never a workflow input |
| Claim | CI dispatch | Single use, 10 min, bound to repository, job, and (GitHub/GitLab) run id | GitHub/GitLab: the CI's OIDC JWT. Gitea < 29: a 128-bit claim code input (§5.3) |
| Repo read, sandbox | Sandbox | See below | E2B `Secret.fill` header injection for the git host where possible. Otherwise an env var for the clone step only, unset before the CLI starts |
| Repo read, CI | Customer CI | `GITHUB_TOKEN` with `contents: read` | Native |
| Repo write | **Kaneo API only** | Existing GitHub App installation token (`getVerifiedInstallationOctokit`), or the Gitea/GitLab integration token | Never leaves the API |
| Model key, `repo-ci` | Customer CI secret | Customer's own | `secrets.OPENROUTER_API_KEY`; Kaneo never sees it |
| Model key, sandbox and runner | Job | Per-job OpenRouter key from `POST /api/v1/keys` with `limit = budgetUsd`, deleted with `DELETE /api/v1/keys/{hash}` when the job ends | E2B `Secret.fill` for `openrouter.ai` when available, otherwise an env var. The runner may use its own key instead |
| Management key, E2B key | Kaneo API | Instance | File secrets via `resolveFileSecret`; never sent to jobs |

**Repository read credential for sandboxes, per host.** Each one is minted at start and revoked when the job reaches a terminal state.
- **GitHub:** an installation token, `POST /app/installations/{id}/access_tokens` with `repository_ids: [id]` and `permissions: {contents: "read"}`. Its lifetime is fixed at 1 h, which covers the clone. Revoke it early with `DELETE /installation/token`.
- **GitLab:**
  - Preferred: a project deploy token with `read_repository`.
  - Alternative: a project access token with `read_repository` and Reporter access. `expires_at` is date-only, so its lifetime is under a day, and it may need Premium on gitlab.com.

  Revoke whichever is used through the API.
- **Gitea:**
  - v28 and later: a per-repository read-only deploy token, which covers Git and LFS only.
  - Older versions: a read-only SSH deploy key.

  Gitea personal access tokens cannot be restricted to one repository; Forgejo v15 tokens can.

Sources: [installation tokens](https://docs.github.com/en/rest/apps/apps#create-an-installation-access-token-for-an-app), [revoke](https://docs.github.com/en/rest/apps/installations#revoke-an-installation-access-token), [GitLab project tokens](https://docs.gitlab.com/api/project_access_tokens/), [Gitea deploy tokens](https://github.com/go-gitea/gitea/pull/37306), [Forgejo token scope](https://forgejo.org/docs/latest/user/token-scope/), [OpenRouter key provisioning](https://openrouter.ai/docs/features/provisioning-api-keys).

**Why Kaneo pushes, not CI.**
- PRs created with `GITHUB_TOKEN` do not trigger the repository's workflows, and they require the "Allow GitHub Actions to create and approve pull requests" setting.
- A GitLab `CI_JOB_TOKEN` push is off by default (GA in 18.4). It triggers no pipeline and cannot open an MR.
- Commits made by the API as the App avoid both problems, and they need no customer setting.

- **Commit identity.** The job never has a write token, so it cannot push to `main`, force-push, or edit workflows. The commit step enforces all of these:
  - Kaneo creates only the branch name it generated for this job (§2). It fails if the ref already exists and points at a commit this job did not create. It never updates any other ref.
  - It refuses changesets that touch `.github/workflows/**`, `.gitea/workflows/**`, `.forgejo/workflows/**`, or `.gitlab-ci.yml`, without an override. The GitHub App also has no `workflows` permission, so GitHub rejects such commits anyway.
  - It refuses `.git/**`, absolute paths, `..` segments, more than 300 files, more than 20 MB, and symlinks that point outside the repository.
- **Model context and logging.** Tokens are never put in prompts, in the job spec, or in the changeset. A shell inside the job can still read its environment, which holds the job credential and, without header injection, the model key. That is why both are limited to one job and capped by budget. The job program redacts their values from log chunks before sending them. On the Kaneo side, tokens are kept out of logs and events:
  - The callback routes run under `withoutOutboundTelemetry` and never log bodies.
  - Errors are stored as stable codes, like the runner's `catch` block.
  - Changesets are not shown to the assistant model.
- **GitHub App permissions.** The setup docs currently list Contents: read and Pull requests: read. Coding jobs also need these:
  - Contents: write, to create the branch and commit server-side;
  - Pull requests: write;
  - Actions: write, to dispatch and cancel runs;
  - Actions: read, plus a subscription to `workflow_run`, as an optional fallback for "the run failed before claiming".

  When an app's permissions grow, each installation owner must approve before tokens carry the new permission. Until then, `availability()` reads the installation's `permissions` and reports `degraded: app_permissions_pending`. **Open question:** on Cloud, should these permissions go on a separate "Kaneo Agent" App, so issue sync installations never need re-approval?
- **Confused deputy.** The App can write to repositories the requester cannot. On GitHub, start and apply therefore require the requester's linked GitHub account to have `write`, `maintain`, or `admin` on the repository. This reuses `getGithubAccount` and `getCollaboratorPermissionLevel` from `github-integration/controllers/verify-repository-owner.ts`. Gitea and GitLab integrations have no linked identity, so there it relies on the per-repository opt-in plus the permission (§8).
- **Gitea token scope.** Gitea integration tokens are documented as "read repository, write issues". Code-enabled repositories need `write:repository`. `availability()` reports `degraded: token_scope`.

## 5. `repo-ci`

### 5.1 Dispatch

| Host | Dispatch, using the credential the API already holds | Run id at dispatch | Cancel |
| --- | --- | --- | --- |
| GitHub | `POST /repos/{o}/{r}/actions/workflows/kaneo-agent.yml/dispatches` with `{ref, inputs: {job}, return_run_details: true}` (Actions: write) | Yes. `200 {workflow_run_id, html_url}`, available since 2026-02-19 | `POST …/actions/runs/{id}/cancel` |
| Gitea ≥ 1.24 | `POST /api/v1/repos/{o}/{r}/actions/workflows/{file}/dispatches` with `{ref, inputs}` | Since 1.26: query parameter `?return_run_details=true`. Before that, `observe()` lists runs | Run-management and force-cancel APIs since v28 |
| GitLab ≥ 18.1 | `POST /projects/:id/pipeline` with `{ref, inputs: {kaneo_job}}` (GA in 18.1); the pipeline uses a `spec:inputs` component | Yes. The pipeline object (`id`, `web_url`) | `POST /projects/:id/pipelines/:id/cancel` |

- `repository_dispatch` is rejected because it returns no run id and needs Contents: write.
- The only workflow input is the job id. GitHub inputs are readable by anyone who can read the repository, and limits apply (25 properties, 65,535 characters). Instructions and the spec are therefore fetched after the claim.

Sources: [GitHub dispatch](https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event), [run ids changelog](https://github.blog/changelog/2026-02-19-workflow-dispatch-api-now-returns-run-ids), [Gitea swagger](https://gitea.com/swagger.v1.json), [GitLab pipelines API](https://docs.gitlab.com/api/pipelines/#create-a-new-pipeline).

### 5.2 Workflow file users add (GitHub)

Kaneo shows this file with a copy button and a prefilled link: `https://github.com/{o}/{r}/new/{default}?filename=.github/workflows/kaneo-agent.yml&value=…`. The App lacks the `workflows` permission and should keep lacking it.

```yaml
name: Kaneo agent
on:
  workflow_dispatch:
    inputs:
      job:
        description: Kaneo job ID
        required: true
        type: string
permissions:
  contents: read     # checkout only; Kaneo commits and opens the PR
  id-token: write    # OIDC token proves this run to Kaneo
concurrency:
  group: kaneo-agent-${{ inputs.job }}
jobs:
  agent:
    runs-on: ubuntu-latest
    timeout-minutes: 60
    steps:
      - uses: usekaneo/agent-action@<pinned-sha> # v1
        with:
          kaneo-url: https://kaneo.example.com
          job: ${{ inputs.job }}
          openrouter-api-key: ${{ secrets.OPENROUTER_API_KEY }}
          # Optional: setup steps run before the agent (toolchains, services).
          # allowed-models: anthropic/claude-opus-5.5,openai/gpt-6.1-sol
```

The action does the following:

1. Requests an OIDC token with `aud=kaneo-url`.
2. Calls `/claim`, which returns the credential and spec. The credential is masked.
3. Checks out `baseSha` with `github.token`, using `persist-credentials: false`.
4. Runs the pinned CLI headless with JSON events and maps them to heartbeats.
5. Builds the changeset from `git diff --binary` against `baseSha`.
6. Uploads the changeset.

Setup steps the repository needs, such as language toolchains or services, can go before the action step. They are the customer's normal CI configuration.

### 5.3 Claim verification

- **GitHub.** Verify the JWT from `https://token.actions.githubusercontent.com` (JWKS cached). Check:
  - `aud`;
  - `repository_id == job.repoId`;
  - `event_name == "workflow_dispatch"`;
  - `workflow_ref` matches `{o}/{r}/.github/workflows/kaneo-agent.yml@refs/heads/{default}`;
  - `run_id == job.externalRef`, the run id returned at dispatch.

  The job must be in `starting`. The claim is single use.
- **GitLab.** Verify the `id_tokens` JWT (`aud` set in the component) against the instance's JWKS (`/oauth/discovery/keys`; verify this path). Check that `project_id` and `pipeline_id` match the job. The token lives as long as the job timeout.
- **Gitea.** Actions OIDC is merged for Gitea 29.0.0 (go-gitea/gitea#39052) but not yet released. Until then, the dispatch also carries a 128-bit single-use **claim code** that expires after 10 minutes; Kaneo stores only its hash. The code is readable in the run UI, but it works only once and only while the job is in `starting`. In the normal case the action redeems it within seconds of starting. A stolen, already-used code is worthless. If an attacker with repository read access redeems it first, the real run's claim fails and the job ends as `failed{claim_conflict}`, which the user sees. On Gitea 29 or later, use OIDC.
- **Caveat:** any step in the CI job, including the agent's shell, can mint the same OIDC token. The token proves "this run", not "this step". That is the same trust level as the job credential, and it is why that credential gets no repository write access.

Sources: [GitHub OIDC](https://docs.github.com/en/actions/reference/security/oidc), [GitLab ID tokens](https://docs.gitlab.com/ci/secrets/id_token_authentication/), [Gitea OIDC PR](https://github.com/go-gitea/gitea/pull/39052).

### 5.4 Which coding agent runs inside

**Recommendation: wrap [opencode](https://opencode.ai/docs/cli/), pinned by version and checksum, inside `kaneo-agent-job`. Do not write our own AI SDK loop.**

Why opencode:
- It is MIT-licensed.
- It supports OpenRouter natively (`-m openrouter/<slug>`) and any OpenAI-compatible endpoint.
- It runs headless with `opencode run --format json`.
- It is a single binary that works on GitHub runners, Gitea act_runner, GitLab runners, E2B, and the local runner.
- It is very actively maintained (v1.19.5 on 2026-10-28).

Our own loop, built on the AI SDK we already use, would give tighter control. But it means building and maintaining file editing, shell, search, and context compaction, which is a product of its own. The wrapper keeps the CLI swappable: one adapter maps the CLI's JSON events to `phase` and `progress`.

Alternatives considered:
- **Codex CLI** (Apache-2.0, `codex exec --json`, an OS sandbox with network off by default) is the runner-up. With OpenRouter it only supports the Responses API, and bubblewrap may fail in unprivileged containers.
- **Claude Code** is excluded as the default because the CLI is proprietary and OpenRouter use is only guaranteed with Anthropic models.
- **Aider** has had no release since 2025-08 and has no JSON event stream.

Wrapper rules:
- **Pin opencode's version.** Its JSON event schema is undocumented and could change.
- **Ship a restrictive `opencode.json`:** deny `webfetch` and `websearch`, deny `external_directory`, allow a bash allowlist plus repository-defined test commands, and run with `--auto`.
- **Do not reuse `anomalyco/opencode/github`.** It is comment-driven and exchanges OIDC with opencode's own App.
- **Keep git out of the agent.** The agent edits the working tree only; the wrapper builds the changeset.
- **Put guidance in the system prompt.** It is built from the job spec, says that the task text and the repository are untrusted data, and says "do not modify CI files".

### 5.5 Progress and results

Progress uses the callback API, not host webhooks. It works the same on all hosts and backends, and it carries phases and the final changeset, which webhooks cannot carry. The existing `pull_request` webhooks still link the PR (§2). `workflow_run` webhooks and `observe()` (`GET …/actions/runs/{id}`) only detect runs that died before reaching the action. One example is a missing `OPENROUTER_API_KEY` secret, which is reported as `failed{ci_run_failed}` with a link to the run.

## 6. `hosted-sandbox` (spike result: E2B first)

The comparison below was researched on 2026-10-28; sources are listed at the end of this section.

| | E2B | Vercel Sandbox | Daytona |
| --- | --- | --- | --- |
| Isolation | Firecracker microVM | Firecracker microVM | Containers by default; VM optional |
| Egress: deny all, allow a list | `denyOut: allTraffic` and `allowOut` with domains (SNI on 443, Host header on 80) or CIDRs; changeable at runtime | Deny-all, domain wildcards, CIDR allow and deny; changeable live | `networkBlockAll`, `domainAllowList` (≤ 100), CIDR list (≤ 10) |
| Secrets kept outside the VM | `Secret.fill` header injection (public beta, ≤ 10 domains) | Header `transform` or your own proxy | Not documented |
| Max session | Hobby 1 h, Pro 24 h; pause/resume | Hobby 45 min, Pro 24 h | Auto-stops after 15 min of SDK inactivity unless disabled |
| Price (2 vCPU / 4 GB / 20 min) | ≈ $0.055 (allocated CPU); Pro $150/mo | ≈ $0.04–0.11 (active CPU only) | ≈ $0.055 |
| Node SDK | Good: `envs`, streaming commands, `setTimeout`, kill, signed lifecycle webhooks | Good: streaming, `AbortSignal`, `writeFiles`; no webhooks | TS SDK; little on lifecycle |
| EU | `europe-west1` (Pro, through support) | Self-serve fra1, cdg1, dub1, arn1, lhr1 | `eu` target |
| Open source / self-host | Apache-2.0; self-hostable on a single KVM host, Terraform, or Kubernetes | No | No; repository archived 2026-10-03 |
| Bring your own key | Easy: free signup, one API key | Needs a team id, a project id, and a broad access token | Easy, but low limits until topped up |

**Recommendation: E2B.**
- It is the only open-source and self-hostable option, so a self-hoster's "bring your own provider" can also mean their own hardware with the same SDK.
- It isolates with microVMs and has a domain egress allowlist.
- Header injection keeps the git and model keys out of the VM.
- It has signed lifecycle webhooks.
- A single API key fits bring-your-own-key.

Keep the adapter thin so Vercel Sandbox can be added second; its firewall and EU regions are stronger. Cloud needs E2B Pro for jobs longer than 1 h and for the EU region.

**Adapter (`agent/code/backends/e2b.ts`).** `start()` does the following:
- Creates a sandbox from the `kaneo-agent-job` template, built from the same Dockerfile as the runner image, with `metadata.jobId` and `timeout = deadline`.
- Sets egress to deny all, then allows:
  - the git host;
  - `openrouter.ai`;
  - the npm, PyPI, and crates registries;
  - `KANEO_CODE_SANDBOX_ALLOW_DOMAINS`;
  - Kaneo's public API host.
- Uses `Secret.fill` to put `Authorization` on the git host (read token) and on `openrouter.ai` (per-job key).
- Passes the job credential, the only secret inside the VM, as `envs`.
- Runs `kaneo-agent-job` in the background.

`cancel()` calls `Sandbox.kill`. E2B `killed` webhooks feed `observe()`. Kaneo still treats heartbeats as the source of truth.

**Caveats:**
- E2B says env vars are visible inside the OS. This is acceptable only for the job credential, which works only for this job.
- Blocked connections can appear to succeed from inside, so the job program must time out its network calls.
- When domains are allowed, `8.8.8.8` is also allowed for DNS.

Sources:
- E2B: [pricing](https://e2b.dev/pricing), [internet access](https://docs.e2b.dev/sandbox/internet-access), [env vars](https://docs.e2b.dev/sandbox/environment-variables), [lifecycle webhooks](https://docs.e2b.dev/sandbox/lifecycle-events-webhooks), [open source](https://e2b.dev/open-source.md), [security](https://docs.e2b.dev/faq/security-and-compliance)
- Vercel Sandbox (updated Aug–Sep 2026): [concepts](https://vercel.com/docs/sandbox/concepts), [firewall](https://vercel.com/docs/sandbox/concepts/firewall), [pricing](https://vercel.com/docs/sandbox/pricing), [SDK](https://vercel.com/docs/sandbox/sdk-reference), [regions](https://vercel.com/docs/sandbox/concepts/regions)
- Daytona: [pricing](https://www.daytona.io/pricing) (2026-10-20), [sandboxes](https://www.daytona.io/docs/en/sandboxes/), [network limits](https://www.daytona.io/docs/en/network-limits/), [repo](https://github.com/daytonaio/daytona)
- Modal, gVisor with a domain allowlist ([docs](https://modal.com/docs/guide/sandbox-networking)), and Cloudflare Sandbox, deny by default with credential-injecting Outbound Workers ([changelog 2026-04-13](https://developers.cloudflare.com/changelog/post/2026-04-13-sandbox-outbound-workers-tls-auth/)), are viable later adapters but not first choices.

**Not verified:**
- whether a Vercel access token can be scoped to Sandbox only;
- E2B Dockerfile templates and streaming details on 2026 docs pages;
- Daytona's isolation runtime and SOC 2 Type II status.

## 7. `local-runner`

`kaneo-agent-runner` is an optional image, `ghcr.io/usekaneo/kaneo-agent-runner`, for single-tenant self-hosted instances. It is never offered on Cloud.

**Registration.**
- An instance admin creates a runner in admin settings. That inserts an `agent_runner` row and shows a token once; only its SHA-256 is stored, like API keys.
- The runner sends `KANEO_RUNNER_TOKEN` as a bearer to `/api/agent-runners/*`.
- Runners are instance-scoped because the operator trusts all workspaces on the instance. Optional `labels` restrict a runner to listed workspace ids.
- Disabling a runner marks its running jobs `failed{runner_lost}` at the next heartbeat expiry.

**Pull protocol.** This reuses the Postgres lease pattern.

1. `POST /api/agent-runners/claim` is long-polled for up to 25 s. In a transaction it selects the oldest `queued` job with `backend='local-runner'`, ordered by `createdAt`, using `for update skip locked`. It sets `running`, `runnerId`, `leaseExpiresAt`, and a new job credential. It returns `{job spec, jobToken, readToken?}`.
2. The runner starts one throwaway container per job. The job program inside talks to the same `/api/agent-jobs/*` API as every other backend.
3. Runner heartbeats (`POST /agent-runners/heartbeat`) update `lastSeenAt` and return job ids to kill. Job heartbeats extend the lease.

**Isolation baseline** for each job container:
- rootless Docker or Podman; `--user` non-root; `--read-only` root with a tmpfs workspace;
- `--cap-drop=ALL`, `--security-opt no-new-privileges`, default seccomp;
- `--pids-limit`, `--memory`, `--cpus`;
- no host mounts and no Docker socket. The runner itself needs the socket or rootless Podman, so it runs on a host the operator dedicates to it.
- **Egress:** a per-job network whose only route is an egress proxy sidecar with the same domain allowlist as §6. Optionally use `runtime: runsc` (gVisor) when it is installed.
- **Model key:** the runner's own `KANEO_RUNNER_OPENROUTER_API_KEY`, or a per-job key that Kaneo minted.

**Docker Compose:**

```yaml
  kaneo-agent-runner:            # optional
    image: ghcr.io/usekaneo/kaneo-agent-runner:latest
    environment:
      KANEO_URL: http://kaneo:5173
      KANEO_RUNNER_TOKEN: ${KANEO_RUNNER_TOKEN}
      KANEO_RUNNER_MAX_JOBS: 1
      KANEO_RUNNER_RUNTIME: runc   # or runsc
    volumes: ["/var/run/docker.sock:/var/run/docker.sock"]  # or a rootless Podman socket
    restart: unless-stopped
```

**Helm:**
- A `runner.enabled: false` block adds a Deployment that creates a Kubernetes Job per agent job instead of using Docker. It runs with `restricted` Pod Security, a NetworkPolicy that allows only the egress proxy, and an optional `runtimeClassName: gvisor`.
- `validations.yaml` fails the release when `runner.enabled` is set together with a Cloud flag.

## 8. Threat model

| Threat | Mitigation | Backend notes |
| --- | --- | --- |
| Prompt injection from task text, comments, or mentions turns the assistant against the user, for example "open a job that adds a backdoor" | The assistant only proposes; a person reviews the instructions before starting. Task context is wrapped as untrusted data, as in the runner's system prompt. The PR is reviewed before merge | All |
| Prompt injection from repository contents (README, issues, malicious `AGENTS.md`) steers the coding CLI | Damage is bounded: no write token, egress allowlist, budget-limited model key, a changeset policy that refuses CI files, and human PR review. The PR body shows that an agent wrote it | Sandbox and runner: egress allowlist. `repo-ci`: limited by the customer's CI network policy |
| Token exfiltration | No write tokens in jobs. The read token is limited to one repository and revoked at the end; with E2B it is injected outside the VM. The job credential works only for its job, and only until a terminal state. The per-job model key has a dollar limit and is deleted. The management, E2B, and integration tokens never leave the API | `repo-ci`: the customer's own model secret is exposed to their own CI, as with any CI step |
| Malicious dependencies or install scripts | They run only inside the throwaway environment: microVM (E2B), gVisor or rootless container (runner), or the customer's runner (`repo-ci`). There are no host mounts and nothing persists | `local-runner` is weakest without gVisor; the docs say so |
| CI secret theft through the PR branch (a workflow edit runs with secrets on push) | Changesets that touch CI files are refused, and the App has no `workflows` permission | All |
| Confused deputy: a Kaneo member uses the App to write a repository they cannot write | The `agent:run_code` permission, plus an admin opt-in per repository, plus a GitHub collaborator write check against the linked account. Only the branch Kaneo generated for the job; never the default branch; never merge | Gitea/GitLab: opt-in plus permission only (**open question:** require token owner == requester?) |
| Cross-tenant on Cloud | Kaneo runs no customer code on its own infrastructure; `local-runner` is disabled. Each E2B sandbox is a fresh microVM for one job. Every callback checks the job credential against job → workspace. Commit and link run through `getVerifiedInstallationOctokit`, which checks repository identity | Cloud |
| Abuse and cost | Per-user and per-workspace active-job limits, plus 10 jobs per hour per user; `budgetUsd` per job (OpenRouter `limit`); a workspace monthly cap; `deadline`; billing entitlement. Starting requires a non-anonymous member who is not banned (`assertAgentAccess`) | `repo-ci` spends customer CI minutes and keys; Kaneo limits dispatch frequency |
| Forged callbacks or replay | Job credential hashed and compared in constant time; single-use claim; OIDC verified with `aud` and `repository_id`; a single-use changeset upload; no state change outside the lifecycle | All |
| Leaks through logs, events, or WebSockets | WebSocket payloads hold ids only. Log chunks are redacted by the job program and capped, and are visible only to people who can see the run. Errors are stable codes. Changesets are never sent to the assistant model or to events | All |
| Audit trail | `agent_run`, `agent_proposal` (who applied), and `agent_job` (requester, backend, external ref, commit SHA, PR, cost) are kept as long as runs are. The host keeps the commit, the PR, and the CI run | All |

## 9. Phased plan

### Phase 1: `repo-ci` on GitHub, end to end

The smallest proof: apply a proposal → workflow dispatched → OIDC claim → changeset → Kaneo commits and opens the PR → task linked → web shows PR #N.

**API, new `apps/api/src/agent/code/` folder:**
- `backend.ts` for the interface;
- `backends/github-actions.ts`;
- `config.ts`;
- `lifecycle.ts`;
- `process-code-jobs.ts`, wired in `worker.ts`;
- `claim.ts` with `verify-github-oidc.ts` (using `jose`, which better-auth already depends on; check this);
- `changeset-schema.ts` and `changeset-policy.ts`, pure and unit-tested;
- `commit-github.ts`: git data API `createTree` with inline content, then `createCommit` and `createRef`, then `pulls.create`;
- `routes/jobs.ts` (web) and `routes/job-callbacks.ts` (public).

**Proposal and permission changes:**
- `schema.ts` gets a `code.run` action in `agentActionSchema`.
- `validate-action.ts` and `action-permissions.ts` add the permission and repository checks.
- `apply-proposals.ts` gets a `code.run` branch that creates the job. It needs no effect row; it notifies `AGENT_JOB_UPDATED` after commit.
- `tools/index.ts` adds `propose_code_job`.
- `packages/permissions` gets `agent: ["run_code"]`, granted to owner and admin and seeded through `defaultRolePayloads`. **Open question:** members too?

**Integration config:** add `codingAgent` to `plugins/github/config.ts`. The GitHub integration settings UI gets an "Enable coding agent" toggle and a workflow-status check.

**Migration:** `agent_job`, `agent_job_event`, `agent_job_changeset`, and `agent_code_setting` through `pnpm --filter @kaneo/api db:generate`. These are new tables only, so it is safe for existing installs. Inspect the SQL.

**Action:** a new repository, `usekaneo/agent-action`. It is a composite action that runs the `kaneo-agent-job` npm package, pinned, plus the chosen CLI pinned by version and checksum.

**Web, `apps/web/src/components/agent/`:**
- `agent-job-card.tsx`, `agent-code-proposal.tsx`, and `agent-repo-chip.tsx`;
- `agent-sandbox-button.tsx`, the header button and popover;
- a code column in `agent-examples.tsx`;
- the PR pill in `agent-recent-run-row.tsx`;
- a task action dialog;
- fetchers and TanStack hooks;
- i18n keys in `i18n/en-US.json`.

**Docs:** update the GitHub setup permissions table and add a coding agent page.

**Tests:**
- unit tests for changeset policy, OIDC claim checks against a test JWKS, the lifecycle reducer, and branch naming;
- `tests/api-integration/agent-code-jobs.test.ts`, with a fake GitHub (an injected Octokit) and the callback API driven directly: proposal → apply → claim → changeset → commit → link, plus cancel, timeout, replay, a cross-workspace credential, and a confused-deputy rejection;
- one manual smoke test on a scratch GitHub repository.

**Open questions:**
- a separate Cloud App versus a permission bump on the existing App;
- whether members get `run_code` by default;
- draft or ready PR;
- whether to require branch protection on the default branch. It is not needed for safety, given server-side commits, but it is good hygiene; warn only.

### Phase 2: `hosted-sandbox` (E2B)

- **Add:** `backends/e2b.ts`; `openrouter-keys.ts` (create and delete per-job keys; record cost from key `usage`); and short-lived GitHub read tokens (`createInstallationAccessToken` with `repository_ids` and `permissions`, revoked at the end).
- **Template:** the `kaneo-agent-job` image, used as the E2B template and later as the runner image.
- **Workspace setting:** a bring-your-own E2B key, encrypted.
- **Cloud:** E2B Pro account, EU region request, budgets wired to billing.
- **Tests:**
  - a fake E2B client in integration tests;
  - an egress-deny check in the smoke test: the job tries `example.com`, which must fail;
  - a check that no key appears in `agent_job_event`.
- **Open questions:**
  - whether E2B `Secret.fill`, still in beta, covers git over HTTPS for `github.com`, which needs basic auth;
  - whether to proxy model calls through Kaneo instead of minting keys, which would enforce the model allowlist without a management key.

### Phase 3: Gitea and GitLab

- **Gitea:**
  - `backends/gitea-actions.ts` and `commit-gitea.ts` (`POST /repos/{o}/{r}/contents` with multiple files and `new_branch`, then `POST /pulls`);
  - claim codes;
  - read: a read-only deploy token on v28 and later, or an SSH deploy key on older versions;
  - the integration token needs `write:repository`; `availability()` reports when it is missing;
  - `availability()` checks token scope and server version.
- **GitLab:**
  - `backends/gitlab-ci.ts` and `commit-gitlab.ts` (`POST /projects/:id/repository/commits` with `actions[]` and `start_branch`, then `POST /merge_requests`);
  - OIDC through `id_tokens`;
  - a deploy token for sandbox reads;
  - a CI component in place of the action.
- **Both:** extend the PR/MR link paths (`plugins/gitea/webhooks/pull-request-opened.ts`, `plugins/gitlab/webhooks/merge-request-opened.ts`) so they link through the same suffix and title rules; both already use the shared branch patterns.
- **Tests:** a fake host for each, in integration tests.

### Phase 4: `local-runner`

- **API:** the `agent_runner` table, admin routes (create, disable, list with `lastSeenAt`), and `/api/agent-runners/claim|heartbeat`. Mount them only when `!isCloud()` and `local-runner` is in `KANEO_CODE_BACKENDS`.
- **Runner:** a new package, `packages/agent-runner` (Node). It uses the Docker Engine API through the socket or Podman. Per job it creates a network, an egress proxy, and the job container.
- **Helm:** the `runner` block, a NetworkPolicy, and a validation. Compose gets a commented optional service.
- **Tests:** claim, lease expiry, and disabled-runner behavior in integration tests; a container hardening check in CI (`docker inspect` assertions).
- **Open questions:** Kubernetes Job mode versus a Docker-only first release; and labels for repository toolchains, such as a runner with a GPU or a JDK.
