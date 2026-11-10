# CI and upstream automation plan

**Status:** documentation-only plan. Existing Kaneo workflow YAML files remain unchanged by this scaffold.

Planned workflows (not yet created):

- `upstream-kaneo.yml` — periodically check `usekaneo/kaneo`, open reviewable sync PRs to the fork's protected `develop` branch, never silently force-push or auto-merge.
- `upstream-orchestrator.yml` — monitor compatible upstream Orchestrator releases and, only if opted in later, propose a pinned submodule update PR. This does not update the founder's locally installed desktop app.
- `integration-tests.yml` — verify feedback-to-task boundaries, GitHub issue intake, MCP permissions, end-to-end release evidence and key compatibility contracts.
- `release.yml` — **already exists as an upstream-owned workflow**. Do not create a second file or replace its contents; any changes require a separate reviewed proposal.

Kaneo upstream uses some CI runner/actions that may be unavailable in this fork. Preserve the fork's GitHub-hosted CI adaptations and test any future upstream update carefully.

See [upstream policy](../../docs/upstream-policy.md) and [milestones](../../docs/milestones/README.md). This README does not configure or schedule any GitHub Actions.
