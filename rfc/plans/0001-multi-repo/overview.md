# Implementation Plan Overview — Multiple Repositories per Project (RFC 0001)

## 1. Source and scope

This plan operationalizes RFC 0001 ("Multiple repositories per project") for the Kaneo fork `PhS-Orivado/kaneo`, branch `docs/multi-repo-integrations`. The RFC text is the design record; this plan decomposes it into one implementation document per work package (WP0 through WP9), extends it with a new work package for billing limits (WP10), and records two governing decisions that override open decisions in RFC section 10.

Upstream references: usekaneo/kaneo#791 (multiple GitHub repositories), usekaneo/kaneo#1282 (multiple Gitea repositories).

## 2. Governing decisions

Two decisions were taken by the plan owner and are binding for every work package. Each WP document states its local consequences; this section is the authoritative record.

### Decision D1 — Cross-project repository sharing is allowed

RFC section 10.1 leaves open whether one repository may feed several projects. Decision: sharing is allowed for all three providers.

Consequences for the design:

| Aspect | RFC default | Binding decision |
|---|---|---|
| Instance-wide constraint `unique(type, repository_key)` | Encode global 1:1 | Not introduced. A repository may be bound by any number of projects |
| Per-project constraint `unique(project_id, type, repository_key)` | Prevent double link in one project | Kept, and it becomes the only uniqueness rule for repository bindings |
| Lookup index on `(type, repository_key)` | Unique index | Plain non-unique index; it exists solely to make webhook fan-out an indexed lookup |
| Create controllers | 409 when the repository is already linked to another project | No cross-project check at all. Only same-project duplicates return 409 |
| Gitea create controller conflict scan | O(n) JSON scan over all gitea rows | Deleted entirely; nothing replaces it |
| Webhook semantics | Fan-out already iterates all matching bindings | One repository event can create tasks in every bound project; external_link and github_import rows remain isolated because both are keyed by integration_id |

Rationale: the GitHub webhook layer already supports fan-out (`findAllIntegrationsByRepo` returns every matching binding), task numbering is project-scoped, and external identifiers are repository-scoped, so no data model collision exists. Sharing mirrors Linear-style behavior and removes the only cross-project state coupling in the create path.

### Decision D2 — Repository count limits per billing plan

RFC section 10.2 leaves per-plan limits open. Decision: a per-workspace limit on repository bindings per project is introduced, resolved from the workspace's billing plan, and enforced at binding creation and reactivation. This is a new work package, WP10, because the repository currently contains no billing or plan infrastructure and the limit mechanism must be a reusable abstraction that a cloud billing stack can plug into.

Summary of the mechanism (full detail in the WP10 document):

- Limit unit: number of active repository bindings (GitHub, Gitea, GitLab) per project.
- Resolution order: per-workspace override (set by billing) over instance default (`KANEO_MAX_REPOSITORIES_PER_PROJECT`, unset means unlimited).
- Enforcement: shared helper `assertRepositoryBindingQuota` called by all three create controllers and by reactivation updates; violation returns HTTP 402 with a machine-readable error code.
- Usage exposure: list endpoints return a usage summary so the UI can show "N of M repositories linked" without a second call.

## 3. Work package map

| WP | Title | Document | Depends on | PR (revised slicing) |
|---|---|---|---|---|
| WP0 | Database migration | `wp0-database-migration.md` | — | PR1 (S) |
| WP1 | Access control middleware | `wp1-access-control-middleware.md` | — | PR2 (S) |
| WP10 | Plan-based repository limits | `wp10-plan-limits.md` | WP0 | PR3 (S/M) |
| WP2 | GitHub backend | `wp2-github-backend.md` | WP0, WP1, WP10 | PR4 (M) |
| WP3 | Gitea backend | `wp3-gitea-backend.md` | WP0, WP1, WP10 | PR5 (M) |
| WP4 | GitLab backend | `wp4-gitlab-backend.md` | WP0, WP1, WP10 | PR6 (M) |
| WP5 | Integration sync | `wp5-integration-sync.md` | WP2 | PR7 (M) |
| WP6 | Workflow rules | `wp6-workflow-rules.md` | WP0 | PR8 (M) |
| WP7 | Web frontend | `wp7-web-frontend.md` | WP2, WP3, WP4, WP10 | PR9 (L) |
| WP8 | Documentation, OpenAPI, MCP | `wp8-docs-openapi-mcp.md` | WP2–WP4, WP10 | PR10 (S) |
| WP9 | Tests | `wp9-tests.md` | all | per PR, matrix tracked centrally |

The cleanup PR (retiring the legacy `github_integration` table and `get-github-integration-by-repository-id.ts`) remains scheduled after PR4 and is described inside the WP2 document.

## 4. Rollout order

1. WP0 — schema migration ships first; it is additive and safe to run before any controller change.
2. WP1 — `workspaceAccess.fromIntegration` middleware, independent of WP0.
3. WP10 — quota core (limits resolution, helper, workspace override table) with no callers yet.
4. WP2, WP3, WP4 — provider backends, GitHub first as the review template; each wires the quota helper and lands with its own tests.
5. WP5, WP6 — re-keying of integration sync and workflow rules.
6. WP7 — web frontend, including the quota indicator and the shared repository list components.
7. WP8 — documentation, OpenAPI export, MCP version review.
8. WP9 — the test matrix is the acceptance ledger; every PR lands its slice of the matrix, and nothing is deferred to a final test PR.

Compatibility shims during rollout: the old project-keyed GET endpoints temporarily return the first binding until the new web client has shipped (RFC section 8).

## 5. Shared conventions

These definitions are used identically in every work package document.

### 5.1 Repository key formats

| Provider | Format | Example |
|---|---|---|
| github (verified) | `github:<numeric repository id>` | `github:402311029` |
| github (legacy, unverified) | `github:<owner>/<name>`, lowercased | `github:usekaneo/kaneo` |
| gitea | `gitea:<normalized baseUrl>/<owner>/<name>`, lowercased | `gitea:https://git.example.com/kaneo/api` |
| gitlab | `gitlab:<normalized baseUrl>/<full project path>`, lowercased | `gitlab:https://gitlab.example.com/group/subgroup/app` |

### 5.2 Constraint and index names (WP0 is authoritative)

| Name | Kind | Columns | Purpose |
|---|---|---|---|
| `integration_project_type_repo_unique` | unique | `(project_id, type, repository_key)` | No duplicate binding inside one project |
| `integration_type_repository_key_idx` | non-unique index | `(type, repository_key)` | Indexed webhook fan-out lookup; deliberately non-unique per D1 |
| `integration_project_type_null_repo_unique` | partial unique index | `(project_id, type) WHERE repository_key IS NULL` | Preserves one-row-per-project for non-git integrations after `integration_project_type_unique` is dropped |
| `integration_projectId_idx`, `integration_type_idx` | existing indexes | — | Unchanged |

### 5.3 Error contract additions

| Condition | Status | Code | Notes |
|---|---|---|---|
| Repository already linked to the same project | 409 | `repository_already_linked` | Mapped from the unique violation in the create controllers |
| Repository linked to another project | — (allowed) | — | Per D1; no error is returned |
| Binding limit reached | 402 | `binding_limit_exceeded` | Per D2; response includes `used` and `limit` |
| Integration of another workspace addressed by id | 403 | — | WP1 middleware |

## 6. Cross-cutting risks

| Risk | Mitigation | Owner WP |
|---|---|---|
| Unique violation surfaces as 500 instead of 409 | Shared constraint-name-to-message helper; tests cover both paths | WP2, WP3, WP4 |
| Legacy GitHub configs lack repositoryId | Owner/name key; upgrade through re-verification flow | WP0, WP2 |
| API consumers break on array shapes | Compat shim (first binding from old GET) until consumers migrate; MCP version bump | WP2, WP8 |
| Webhook fan-out latency on large instances | Indexed `(type, repository_key)` lookup replaces the JSON scan | WP2 |
| UI drift between the three provider sections | Shared repository-row component | WP7 |
| Quota bypass through reactivation (`isActive` false to true) | Quota check on update path as well as create | WP10 |
| Non-git integrations lose their single-row guarantee when `integration_project_type_unique` is dropped | Partial unique index on NULL repository keys | WP0 |