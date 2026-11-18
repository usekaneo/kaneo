# WP7 — Web Frontend

RFC 0001, WP7 with the UX specification of sections 6 and 7. Governing decisions: D1 (cross-project links are selectable with an informational note) and D2 (quota indicator and limit-reached flow from WP10).

## 1. Objective

Replace the single-integration settings components for GitHub, Gitea, and GitLab with a repository list surface: per-provider list, per-row actions, add flow through the existing repository browser modals, per-binding sync and workflow rule scope, and the quota indicator.

## 2. Design contract

The visual contract is the existing Kaneo design system: Geist variable type, the Radix-based primitives in `apps/web/src/components/ui`, current Tailwind tokens, lucide-react icons. No new visual language, palette, or typography is introduced on the settings surface. Design dials: variance low (consistency over novelty inside an existing product), motion only where it explains a state change (list add/remove, dialog enter/exit), density high (repository rows carry identity, status, metadata, and actions in one scan).

## 3. Information architecture

Project settings keeps one section per provider. Each section renders:

1. A repository list: single-column rows, one row per binding. Not a card grid.
2. An add action at the section top, visible only to users with `workspace:manage_settings`.
3. The quota indicator from WP10 ("N of M repositories linked", or "N repositories linked" when unlimited), rendered with the existing Badge primitive next to the section heading.

Repository row contents, left to right:

- Identity: owner/name (GitHub/Gitea) or project path (GitLab), with the instance host as secondary text for Gitea/GitLab.
- Status: chips for Active, Paused (isActive false), and Needs verification (legacy GitHub binding), derived during render from the list data. Status chips expose their meaning as text, not color alone.
- Meta: linked issue count and last import state when available.
- Actions: overflow menu with Sync rules, Workflow rules, Import issues, Disconnect.

First-repository flow: when the list is empty, the section shows the current connect form unchanged. After the first link, the form is replaced by the list, and adding repositories happens through the existing repository browser modals (`repository-browser-modal.tsx`, `gitea-repository-browser-modal.tsx`). The entry experience stays identical to today; multi-repo is an additive capability.

Disconnect confirmation: an AlertDialog (never a toast) that states exactly what happens: the binding, its external links, and its import state are removed; tasks created from its issues remain in the project.

Cross-project annotations (D1): in the browser modal, a repository already linked to the addressed project is blocked with an inline reason and the one action that clears it (disconnect first). A repository linked to another project remains selectable and carries an informational note ("Already linked in another project"); the create call succeeds by design.

Quota interactions (D2): the usage summary comes from the list response. When the limit is reached, the add action remains visible; selecting a repository and submitting leads to the server's 402, which the client renders inline in the browser modal with the upgrade call to action. The option is never silently greyed out; the blocker and the action that resolves it are always shown together.

## 4. Component structure

The current `github-integration-settings.tsx` is around 29,000 characters. Each provider settings component is split, each file well under 200 lines:

| Component | Responsibility |
|---|---|
| `<provider>-integration-settings.tsx` | Section shell: heading, quota badge, list or connect form, add action |
| `integration-repository-list.tsx` | Rows, empty state, loading skeleton, error retry |
| `integration-repository-row.tsx` | Shared row layout for all three providers, parameterized by provider metadata (identity label, host display, available actions); memoized |
| `integration-repository-card.tsx` (or merged into row) | Per-row status derivation and overflow menu |
| `connect-form.tsx` | The current connect form, reused for the first repository |

The row layout is shared across the three providers as a single parameterized component; three divergent implementations of the same list are explicitly out.

## 5. Data layer

Fetchers (new): `list-github-integrations.ts`, `list-gitea-integrations.ts`, `list-gitlab-integrations.ts`; per-integration variants of update, delete, and import with `integrationId` in the payload. Fetchers stay thin and typed against the OpenAPI response schemas; zod schemas are shared between fetcher and hook so list and detail shapes cannot drift.

Hooks:

- List query key: `[provider + "-integrations", projectId]`. The list query and the app-info query run as independent `useQuery` calls; no fetching chain.
- Mutations carry `integrationId`; detail-scoped work keys invalidate the list, not unrelated project queries.
- Optimistic add/remove of rows uses functional updates on the query cache; the 402 and 409 mutation errors map to actionable UI states with server-provided `used`/`limit` data.

Cross-referencing browser modal results with linked bindings uses a `Map` keyed by repository key, never repeated `find()` over the array.

## 6. React implementation rules (acceptance criteria for the PR)

| Rule | Application |
|---|---|
| async-parallel | List and app-info queries are independent useQuery calls |
| client-swr-dedup | Query keys per provider and project; detail-scoped invalidation |
| rerender-no-inline-components | RepositoryCard and its menu are module-scope components |
| rerender-derived-state | Counts and flags (hasBindings, needsVerificationCount) derived with useMemo during render, never set from effects |
| rerender-functional-setstate | Optimistic list updates via functional setState on the query cache |
| js-set-map-lookups | Browser-modal cross-reference via Map keyed by repository key |
| rendering-conditional-render | Ternaries for conditional rendering where a falsy value could render an unwanted node |
| bundle-dynamic-imports | The repository browser modal is imported lazily via next/dynamic-equivalent (React with Vite: React.lazy/Suspense); it is only needed when the add action opens |
| rerender-memo | Row components are memoized; the list may grow to dozens of bindings |

## 7. States (every new surface)

| State | Specification |
|---|---|
| Empty | Realistic text, no placeholder tokens; connect form for the first repository |
| Loading | Skeleton rows matching the final row layout |
| Error | Retry action, not a dead end |
| Partial | Needs-verification chip for legacy bindings, with the re-verify action |
| Limit reached (D2) | Inline reason in the browser modal plus upgrade call to action; quota badge shows the exact usage |
| Cross-project note (D1) | Informational annotation in the browser modal; selection remains possible |

## 8. Accessibility and interaction

- Dialogs and menus use the existing Radix primitives, which provide focus trapping and roles by default; no ad-hoc markup replaces them.
- Rows are focusable; the overflow menu is reachable and operable by keyboard; focus moves into and out of the browser modal and dialogs correctly and returns to the trigger on close.
- Labels and headings are sentence case; status color semantics follow the existing badge variants; no new gradients, glows, or accent canvases; no three-equal-card layouts.
- Form fields keep their six states (default, focus, filled, error, success, disabled) per the connect form; validation happens on blur with the message under its field, and field rules are shown live while typing.
- Menu with fewer than five options (the row overflow has four) may remain a dropdown; any list beyond ten rows in the browser modal has a search field on top (type to filter), which the existing modals already provide or gain in this PR.

## 9. Sync and workflow rule scope in the UI

- The sync rules surface (`components/project/sync-rules/`) operates per binding: opening it from a row scopes the editor to that row's integrationId; event-driven invalidation is per integration (`integration.sync_rules_changed`), not per project.
- The workflow rule editor (WP6) gains a per-repository selector: type-wide (default, current behavior) or one of the project's bindings; rules list shows the scope per rule. The public shape for type-wide rules is unchanged.

## 10. i18n

New keys under the `settings:githubIntegration`, `settings:giteaIntegration`, and `settings:gitlabIntegration` namespaces in `i18n/`: section headings, quota strings (with and without limit), row action labels, disconnect confirmation copy, limit-reached message, cross-project note, needs-verification chip, and all empty, loading, and error states. No hardcoded strings in components.

## 11. Acceptance criteria

1. All three provider sections render N bindings, support the add flow, and confirm disconnects, verified in component tests.
2. The shared row component is used by all three providers (no divergent row implementations).
3. Quota badge and limit-reached flow behave per WP10, with the server as source of truth.
4. Cross-project repositories remain selectable with an informational note (D1).
5. Every new surface implements the state table in section 7.
6. The React rules table in section 6 passes review; the browser modal is code-split.
7. Settings components each stay well under 200 lines.
8. Keyboard operation of rows, menus, and dialogs works, and focus management is correct on modal open and close.
9. The disconnect AlertDialog copy matches the actual server behavior (links and import state removed, tasks retained).

## 12. Test plan

| Case | Level |
|---|---|
| Web settings list: render N bindings, add flow, disconnect confirmation | component tests |
| Quota badge rendering for limited and unlimited cases | component tests |
| Limit-reached inline error with upgrade CTA after 402 | component tests |
| Cross-project annotation selectable, same-project blocked with reason | component tests |
| Keyboard and focus behavior for rows, menus, modals | component tests |
| Query keys and invalidation per provider and project | hook tests |
| Empty, loading, error, partial states | component tests |

## 13. Risks

| Risk | Mitigation |
|---|---|
| UI drift between the three provider sections | Shared row component is an acceptance criterion; review checklist item |
| Stale single-integration state left in hooks | Query keys change shape; grep for the old single-integration query keys and remove their consumers in the same PR |
| Large lists re-render on every keystroke in the browser modal search | Memoized rows and Map-based cross-reference; the list query is unaffected by modal state |
| Quota UI drifts from server truth | Badge renders only the server-provided usage summary; no client-side counting |