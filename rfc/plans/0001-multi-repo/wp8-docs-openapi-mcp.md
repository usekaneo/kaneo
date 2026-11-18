# WP8 — Documentation, OpenAPI, MCP

RFC 0001, WP8. Governing decisions must be documented as product behavior: D1 (cross-project sharing is permitted and described as a feature) and D2 (limits and the 402 contract).

## 1. Objective

Refresh user-facing documentation for the three git integrations, re-export the OpenAPI specification, review the MCP package for affected endpoints, and version the change.

## 2. User documentation (`apps/docs`)

One page per provider (GitHub, Gitea, GitLab) is updated with the following shared sections; provider-specific details differ only in identity and webhook mechanics.

### 2.1 Shared sections

1. Multiple repositories per project: how to add the first repository (connect form), how to add further repositories (browser modal), and the list surface with per-row actions (sync rules, workflow rules, import, disconnect).
2. What disconnect removes and retains: binding, external links, and import state are removed; tasks created from the repository's issues remain in the project.
3. Cross-project repository sharing (D1): the same repository may be linked to more than one project. Webhook events create tasks in every bound project. Each project maintains its own sync rules, workflow rules, import state, and task numbering. Repositories linked elsewhere are shown with an informational note in the browser modal and can still be linked.
4. Workflow rule scope: type-wide rules apply to every repository of that provider type in the project; repository-specific rules take precedence.
5. Plan limits (D2): what counts (active GitHub, Gitea, and GitLab bindings per project, across providers), the meaning of the quota badge, what happens at the limit (HTTP 402, upgrade path), and that deactivated bindings free quota. Self-hosted default: unlimited, configurable through the instance environment variable.
6. Task numbering: all repositories feed one task sequence per project, giving the global overview requested upstream.

### 2.2 Provider-specific notes

- GitHub: legacy bindings without a verified numeric repository id are marked "Needs verification" and are upgraded to the numeric identity through the existing re-verification flow.
- Gitea and GitLab: webhooks are per binding (per-integration route with a per-row secret). When a repository is shared across projects, the Gitea/GitLab side carries one webhook registration per binding. The instance host is shown as secondary text in the list.

## 3. OpenAPI export

- `openapi:export` is refreshed after the route changes of WP2, WP3, WP4, WP5, and WP6 (each provider PR refreshes its own slice; the final refresh in this PR reconciles the full file).
- List routes: array response schemas, plus the `usage` summary object with `used` and nullable `limit`.
- Id-keyed routes: single-object schemas.
- Documented error responses on the affected operations: 409 `repository_already_linked`, 402 `binding_limit_exceeded` (with used/limit fields), 403 (foreign workspace), 404 (missing integration).
- The webhook routes are unchanged and unchanged in documentation.

## 4. MCP package (`packages/mcp`)

Review the MCP endpoints that surface integration state and mutations. The compatibility approach follows RFC section 8:

| Change | MCP handling |
|---|---|
| Project-keyed GET replaced by list route | New list tool or tool parameter (per integration), versioned |
| Mutations keyed by integrationId | Tools gain an `integrationId` argument with the old project-keyed variants kept during the transition |
| Array response shapes | Schema update; breaking for consumers that assumed a single object |
| 402 and 409 error surfaces | Error codes surfaced in tool results so an agent can relay the blocker and the action that clears it |
| Sync and workflow rule tools | Accept optional integrationId; default remains type-wide |

Versioning: bump the package version with the shape change (minor when purely additive, major when a tool's response shape changes from single object to array). The version bump and a short migration note ship in this PR.

## 5. Internal record

RFC 0001 remains in the repository as the internal design record. The two governing decisions (D1: cross-project sharing allowed; D2: plan-based repository limits introduced as WP10) are recorded in the implementation plan overview and referenced from the RFC's open decisions section in a short amendment commit, so the RFC text and the shipped behavior do not contradict each other.

## 6. Files

| File | Change |
|---|---|
| `apps/docs` integration pages (GitHub, Gitea, GitLab) | Sections 2.1 and 2.2 |
| `apps/docs` plan limits page | New; WP10 behavior for users and self-hosted operators |
| OpenAPI export and response schema files | Refreshed; new error and usage schemas |
| `packages/mcp` | Endpoint review, tool changes, version bump, migration note |
| RFC 0001 | Amendment commit referencing the two decisions |

## 7. Acceptance criteria

1. A user can perform the full multi-repository lifecycle (link, list, rules per repository, import, disconnect) using only the documentation.
2. Sharing semantics, limits, and the 402 contract are documented as behavior, not internals.
3. The OpenAPI export validates and matches the implemented routes (list arrays, usage summaries, error schemas).
4. The MCP package version reflects the shape changes, and its migration note covers the single-to-array transition.
5. Self-hosted documentation states the default (unlimited) and the configuration variable.

## 8. Test plan

| Case | Level |
|---|---|
| OpenAPI export validates against the live routes | CI check (openapi diff) |
| Documentation code samples match current route shapes | review |
| MCP tool schemas type-check against the exported OpenAPI | CI check |

## 9. Risks

| Risk | Mitigation |
|---|---|
| Documentation drift if provider PRs change shapes after the docs PR | Docs PR lands last in the sequence; CI openapi diff catches divergence |
| MCP consumers break silently | Version bump plus migration note; old project-keyed variants kept during the transition window |
| RFC text contradicts shipped behavior (D1 reverses an RFC default) | Amendment commit is an acceptance criterion |