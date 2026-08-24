# GitLab integration design

Date: 2026-08-24
Status: approved for planning

## Purpose

Kaneo has GitHub (App/OAuth install) and Gitea (personal access token) integrations under `apps/api/src/{github,gitea}-integration` and `apps/api/src/plugins/{github,gitea}`. There is no GitLab integration, and no path to connect a self-hosted ("on premise") GitLab instance. This spec adds `gitlab-integration` + `plugins/gitlab`, architecturally mirroring the Gitea integration (same auth model, same feature surface), adapted to GitLab's REST v4 API and webhook model.

## Decisions (confirmed with user)

- **Auth model**: Gitea-style personal/project access token, entered directly in Kaneo. No OAuth app registration or installation flow. Works uniformly against gitlab.com and any self-managed instance via a configurable base URL.
- **Feature scope**: full parity with the Gitea integration — issue import, inbound webhooks driving status transitions, outbound label sync, and task-comment-on-issue linking.

## Non-goals

- No GitLab OAuth app / installation flow (that's the GitHub-style model, explicitly not chosen).
- No inbound "label changed" webhook handler — GitLab does not emit a standalone label webhook event (see §3).
- No new workspace permission — reuses `manage_settings`, exactly as GitHub and Gitea do.
- No database schema migration — `integrationTable` and `workflowRuleTable` are already polymorphic on `type` / `integrationType`.

## 1. Identity, auth, and storage

**Auth.** GitLab personal or project access tokens authenticate via the `PRIVATE-TOKEN` request header (GitLab's convention; Gitea uses `Authorization: token <token>`).

**Project identity.** GitLab addresses a project by numeric ID or URL-encoded full namespace path (arbitrary nesting: `group/subgroup/project`). Unlike Gitea/GitHub's owner+name pair, config stores a single `repositoryPath` field holding the full namespace path exactly as it appears in a GitLab URL. All API calls URL-encode this path into `/projects/:id` per GitLab's API contract.

**Base URL.** `normalizeGitlabBaseUrl()` mirrors `normalizeGiteaBaseUrl()`: trims trailing slashes, rejects non-http(s) protocols, rejects query/fragment/credentials in the URL (path-injection guard). Every outbound call runs through `assertPublicDestination()` (existing, shared util) before the request — the SSRF guard that already exists for Gitea. Self-managed on-prem GitLab reaches it exactly the way self-hosted Gitea does today, including the `KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS` escape hatch for genuinely internal-only instances.

**Config shape** (`plugins/gitlab/config.ts`, `GitlabConfig`):

```ts
{
  baseUrl: string;           // normalized, http(s) only
  accessToken: string;
  repositoryPath: string;    // e.g. "group/subgroup/project"
  webhookSecret?: string;    // generated at creation, reused across updates
  branchPattern?: string;    // default "{slug}-{number}", shared with github/gitea
  customBranchRegex?: string;
  commentTaskLinkOnGitlabIssue?: boolean; // default true
  statusTransitions?: {
    onBranchPush?: string;   // default "in-progress"
    onMROpen?: string;       // default "in-review"
    onMRMerge?: string;      // default "done"
  };
}
```

**DB.** No schema change. `integrationTable` rows use `type: "gitlab"`; `workflowRuleTable` rows use `integrationType: "gitlab"`. Both columns are already generic strings consumed by Gitea/GitHub today.

**Webhook setup stays manual**, identical to Gitea's flow: `getGitlabIntegration` computes and returns `webhookUrl` (`${apiBase}/gitlab-integration/webhook/:integrationId`) and, when the caller has `manage_settings`, the plaintext `webhookSecret`. The user pastes both into GitLab's project → Settings → Webhooks screen, ticking Push events, Issues events, Merge request events, and Comments (Note) events, with SSL verification per their instance. Kaneo does not call GitLab's `POST /projects/:id/hooks` to register the webhook automatically — same manual-setup posture as Gitea, so there's no new failure mode where Kaneo silently loses the ability to manage a webhook it created.

## 2. Inbound webhooks (GitLab → Kaneo)

**Verification differs from Gitea/GitHub.** GitLab does not HMAC-sign payloads. It echoes the configured shared secret verbatim in the `X-Gitlab-Token` header. `plugins/gitlab/utils/verify-token.ts` does a constant-time (`timingSafeEqual`, length-checked first) string comparison of the header against the stored `webhookSecret` — structurally simpler than `verifyGiteaSignature`'s HMAC-and-decode, but must stay constant-time to avoid a timing side channel on the secret.

**Route.** `POST /gitlab-integration/webhook/:integrationId`, registered in `apps/api/src/index.ts` next to the existing Gitea/GitHub webhook routes. Event type comes from the `X-Gitlab-Event` header (e.g. `Push Hook`, `Merge Request Hook`, `Issue Hook`, `Note Hook`).

**Event mapping** (`plugins/gitlab/webhook-handler.ts` dispatches to `plugins/gitlab/webhooks/`):

| GitLab event (`X-Gitlab-Event` / `object_kind`) | Handler | Behavior (mirrors Gitea file) |
|---|---|---|
| `Push Hook` | `push.ts` | Extract task number from branch name, create/update the `branch` external link, apply `onBranchPush` status transition if not already in a final state. |
| `Merge Request Hook`, action open/reopen | `merge-request-opened.ts` | Create/update `pull_request`-type external link, apply `onMROpen`. |
| `Merge Request Hook`, action merge/close | `merge-request-closed.ts` | Apply `onMRMerge` (only on actual merge, not a plain close, matching Gitea's merged-vs-closed distinction). |
| `Issue Hook`, action open | `issue-opened.ts` | No-op unless the issue was created by Kaneo's own outbound sync (echo guard, see §3). |
| `Issue Hook`, action close | `issue-closed.ts` | Optional status transition if configured. |
| `Issue Hook`, action reopen | `issue-reopened.ts` | Mirrors `issue-reopened.ts`. |
| `Issue Hook`, action update, `changes.labels` absent | `issue-edited.ts` | Title/description sync mirrors Gitea. |
| `Issue Hook`, action update, `changes.labels` present | `issue-labeled.ts` | Diff `changes.labels.previous` vs `.current` to drive Kaneo-side status/label reaction. |
| `Note Hook`, `noteable_type: "Issue"` | `issue-comment-created.ts` | Mirrors `issue-comment-created.ts`, posting the comment into the linked task's activity. |

**Known gap vs. Gitea (intentional, not a missed file):** GitLab has no standalone label-webhook event — label add/remove only surfaces as `changes.labels` on an `Issue Hook` update, handled above. There is no `plugins/gitlab/webhooks/label-created.ts`. Label sync from Kaneo → GitLab remains available via the outbound path in §3; the only unsupported direction is a GitLab-side label edit that isn't accompanied by any other issue change reaching Kaneo as a discrete "label event" — it still arrives, just folded into the general issue-update payload rather than a separate hook.

**Repeated pattern from Gitea worth carrying over:** the outbound-echo window (`OUTBOUND_STATE_ECHO_WINDOW_MS`, compares the issue's `updated_at`/`created_at` against Kaneo's own last outbound write) prevents a Kaneo-initiated GitLab update from bouncing back as a duplicate inbound status change. `plugins/gitlab/utils/outbound-echo.ts` mirrors this using GitLab's `updated_at` issue field.

## 3. Outbound events (Kaneo → GitLab) + API client

`plugins/gitlab/events/` mirrors Gitea's six `TaskEventHandler`s exactly: `onTaskCreated`, `onTaskStatusChanged`, `onTaskPriorityChanged`, `onTaskTitleChanged`, `onTaskDescriptionChanged`, `onTaskCommentCreated`. Each reuses the existing generic `plugins/github/services/{link-manager,task-service}` and `plugins/gitlab/utils/resolve-column.ts` (a straight copy of Gitea's `resolve-column.ts`, keyed to `integrationType: "gitlab"`) — these services are already integration-agnostic, so no changes are needed to them.

`plugins/gitlab/utils/gitlab-api.ts` mirrors `gitea-api.ts`'s shape: 10s timeout via `AbortController`, `redirect: "manual"` (never auto-follow a redirect past the SSRF check), `assertPublicDestination()` before every call, a typed `GitlabApiError` with the same `kind` discriminator (`REDIRECT | INVALID_JSON | HTTP_ERROR | TIMEOUT | EMPTY_RESPONSE`). Endpoint differences from Gitea's client:

- Base path `/api/v4` (vs `/api/v1`).
- Auth header `PRIVATE-TOKEN: <token>` (vs `Authorization: token <token>`).
- Project-scoped paths use `/projects/${encodeURIComponent(repositoryPath)}` instead of `/repos/${owner}/${repo}`.
- Issues are addressed by `iid` (project-scoped sequential number — this is what maps to Kaneo's `{number}` in branch names, same role as Gitea's `index`), not a global `id`.
- Comments live at `/projects/:id/issues/:issue_iid/notes` (GitLab calls them "notes", not "comments").
- Labels: GitLab issues carry a `labels` field as a comma-joined string on create/update, plus `add_labels`/`remove_labels` params on the update endpoint — no separate add/replace/remove-label sub-resource calls like Gitea needs. `sync-label-to-gitlab.ts` is correspondingly simpler than `sync-label-to-gitea.ts`.
- Token verification: `GET /user` (identical role to Gitea's `verifyGiteaToken`, same endpoint name coincidentally).

`import-gitlab-issues.ts` mirrors `import-gitea-issues.ts`: paginate `GET /projects/:id/issues?state=opened`, skip entries with a `merge_requests_count` indicating they're actually MRs surfaced as issues (GitLab keeps these separate by default, so this is a defensive check rather than a required filter), create/update Kaneo tasks keyed by GitLab issue `iid`.

## 4. Web UI

- `apps/web/src/components/project/gitlab-integration-settings.tsx` and `gitlab-repository-browser-modal.tsx`, mirroring the Gitea components 1:1 — base URL + token entry, verify button, repository browser, webhook URL/secret display, branch pattern and status-transition config.
- `apps/web/src/fetchers/gitlab-integration/{list-gitlab-repositories,create-gitlab-integration,update-gitlab-integration,delete-gitlab-integration,verify-gitlab-access,get-gitlab-integration,import-gitlab-issues}.ts` — direct ports of the Gitea fetchers.
- `apps/web/src/hooks/{mutations,queries}/gitlab-integration/` — direct ports of the Gitea hooks (`use-create-gitlab-integration`, `use-update-gitlab-integration`, `use-import-gitlab-issues`, `use-get-gitlab-integration`).
- Added as a new tab alongside the existing GitHub/Gitea tabs in project integration settings (same parent component that currently renders `GiteaIntegrationSettings`).
- i18n (`i18n/en-US.json`, source of truth): `gitlabSectionTitle` ("GitLab Integration"), `gitlabSectionSubtitle` ("Synchronize tasks with GitLab.com or a self-hosted GitLab instance (issues, merge requests, webhooks)."), `gitlabIntegration.*` validation strings (mirroring `giteaIntegration.baseUrlInvalid` etc.), `gitlabHeading`/`gitlabHint` for the workflow-rule mapping section.

## 5. Registration points

- `apps/api/src/index.ts`: import `gitlabIntegration, { handleGitlabWebhookRoute }`; register `POST /gitlab-integration/webhook/:integrationId`; mount `const gitlabIntegrationApi = api.route("/gitlab-integration", gitlabIntegration)`; add to the API union response type list alongside `giteaIntegrationApi`.
- `apps/api/src/plugins/index.ts`: `import { gitlabPlugin } from "./gitlab"` and `registerPlugin(gitlabPlugin)`.
- `apps/api/src/schemas.ts`: `gitlabIntegrationSchema` (mirrors `giteaIntegrationSchema`, with `repositoryPath` replacing `repositoryOwner`/`repositoryName`).
- Permissions: reuses the existing `manage_settings` workspace permission for all mutating routes (`requireWorkspacePermission({ workspace: ["manage_settings"] })`) — no change to `@kaneo/permissions`.

## 6. Testing

Following the existing Gitea test layout as the template:

- `tests/api/gitlab-integration/verify-gitlab-access.test.ts` (+ a `-fetch` variant covering the raw fetch path), mirroring the Gitea equivalents.
- `tests/api/plugins/gitlab/webhooks/issue-opened.test.ts` and siblings for each handler in §2 — focused unit coverage per event type, especially the label-diff branch in `issue-labeled.ts` and the merge-vs-close branch in `merge-request-closed.ts`.
- `tests/api/plugins/gitlab-ssrf.test.ts`, mirroring `gitea-ssrf.test.ts`, asserting `assertPublicDestination()` is actually invoked on the GitLab client path (private-IP base URL, redirect-to-private-IP, and the `KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS` override).
- A focused test for `verify-token.ts`'s constant-time comparison (correct secret, wrong secret, missing header, timing-safe on length mismatch).
- There is no dedicated `tests/api-integration/gitea-*` file to port from — Gitea's CRUD routes are exercised indirectly through shared cross-cutting suites (`authorization-boundaries.test.ts`, `external-link-secrets.test.ts`). Extend those two suites with GitLab cases (workspace-scoping on the new routes; secret/token redaction on `get-gitlab-integration`) rather than authoring a new integration-test file — that keeps GitLab covered the same way Gitea already is, without inventing a heavier test surface than the precedent it's following.

## File map (new files)

```
apps/api/src/gitlab-integration/
  index.ts
  controllers/
    create-gitlab-integration.ts
    get-gitlab-integration.ts
    delete-gitlab-integration.ts
    verify-gitlab-access.ts
    list-gitlab-repositories.ts
    import-gitlab-issues.ts

apps/api/src/plugins/gitlab/
  index.ts
  config.ts
  webhook-handler.ts
  webhooks/
    push.ts
    merge-request-opened.ts
    merge-request-closed.ts
    issue-opened.ts
    issue-closed.ts
    issue-reopened.ts
    issue-edited.ts
    issue-labeled.ts
    issue-comment-created.ts
  events/
    task-created.ts
    task-status-changed.ts
    task-priority-changed.ts
    task-title-changed.ts
    task-description-changed.ts
    task-comment-created.ts
  utils/
    gitlab-api.ts
    verify-token.ts
    resolve-column.ts
    branch-matcher.ts
    outbound-echo.ts
    webhook-repo.ts
    sync-label-to-gitlab.ts
    system-labels.ts
  services/
    integration-lookup.ts

apps/web/src/components/project/
  gitlab-integration-settings.tsx
  gitlab-repository-browser-modal.tsx
apps/web/src/fetchers/gitlab-integration/  (7 files)
apps/web/src/hooks/mutations/gitlab-integration/  (3 files)
apps/web/src/hooks/queries/gitlab-integration/  (1 file)

tests/api/gitlab-integration/  (2 files)
tests/api/plugins/gitlab/webhooks/  (n files)
tests/api/plugins/gitlab-ssrf.test.ts
```

## Modified files

- `apps/api/src/index.ts` — route registration
- `apps/api/src/plugins/index.ts` — plugin registration
- `apps/api/src/schemas.ts` — `gitlabIntegrationSchema`
- `i18n/en-US.json` — new keys
- Whatever parent component currently renders `GiteaIntegrationSettings` in project settings — add the GitLab tab
