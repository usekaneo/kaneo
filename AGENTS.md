# Kaneo agent guide

Kaneo is a fast, deliberately simple, self-hosted project-management platform. The Hono API owns domain behavior and authorization, the React app consumes its typed client, PostgreSQL stores durable state, and events plus WebSockets keep clients current. Redis is optional and coordinates realtime delivery across multiple API instances.

This is an operating guide, not a README. These rules are good defaults; explicit developer and user instructions take precedence.

## Principles

- Simplicity is a product requirement. Build the smallest model that makes correct behavior obvious.
- Features should solve a real problem without making routine work heavier.
- Protect performance, especially on task-heavy boards and realtime views.
- Keep self-hosting straightforward and single-instance deployments first-class. Do not make Redis or another managed service mandatory without an explicit product decision.
- Support both bundled same-origin deployments and separately hosted API and web deployments.
- Protect user data, workspace boundaries, and authorization checks.
- Read the relevant implementation before changing it. Follow an established local pattern when it fits, but do not preserve accidental complexity merely because it exists.
- Stay focused. Do not mix requested work with speculative features, broad refactors, or unrelated cleanup.

## Architecture

- `apps/api` — Hono API, Better Auth, controllers, database access, events, integrations, MCP HTTP routes, and WebSockets.
- `apps/web` — React/Vite UI, TanStack Router and Query, fetchers, hooks, and realtime cache updates.
- `apps/docs` — product and API documentation content; `apps/site` — public Next.js site and documentation host.
- `packages/libs` — shared typed Hono client and URL helpers.
- `packages/permissions` — canonical permission vocabulary and built-in roles.
- `packages/mcp` — published stdio MCP package.
- `charts/kaneo` — Helm deployment surface.
- `tests/api` contains API unit tests; `tests/api-integration` contains PostgreSQL-backed integration tests.

## Boundaries that must hold

- The API is the authority for authentication and authorization. Hiding an action in the UI is not an authorization check.
- Workspace-scoped operations must use the existing `@kaneo/permissions` vocabulary and API middleware.
- Do not expose secrets, credentials, internal fields, or private workspace data through responses, logs, events, WebSockets, or MCP tools.
- Public API behavior must retain accurate Zod validation and OpenAPI metadata.
- Mutations that affect realtime state must consider event publication, WebSocket delivery, and client cache invalidation.
- Database changes must work for existing installations, not only empty development databases.
- User-facing web copy must use static i18n keys. `i18n/en-US.json` is the source of truth.

## Follow a change through

Before calling a behavior change complete, decide which surfaces apply:

- API route, validator, controller, authorization, error behavior, and OpenAPI description. Route middleware declared via `createRoute({ middleware })` runs BEFORE the request validators, so middleware must read the raw request rather than `c.req.valid()`.
- Typed client, web fetcher, query or mutation hook, cache invalidation, and UI states.
- Events, project- or user-scoped WebSockets, and optional Redis fan-out.
- Permission definitions, API enforcement, and UI capability checks.
- MCP, API keys, webhooks, and relevant external integrations.
- Schema, relations, generated migration, indexes, cascades, and existing data.
- Translations, accessibility, user documentation, Docker, and Helm.
- Reverse states: create/delete, assign/unassign, enable/disable, connect/disconnect, and a visible current state.

Not every change touches every surface. Make the decision deliberately rather than expanding scope automatically.

## Project conventions

- Keep API handlers thin and domain behavior in controllers or focused utilities.
- Validate API inputs with Zod through `@hono/zod-openapi`: define routes with `createRoute` and mount them on the `apiRouter()` factory in `apps/api/src/openapi.ts`. Request schemas live in a feature's `schema.ts`, response schemas in its `response.ts` (named with `.openapi("Name")` so they become reusable components). Use `HTTPException` for expected HTTP failures. Valibot remains only for internal, non-HTTP config validation under `plugins/` and `ws/`.
- Use `requireWorkspacePermission` rather than duplicating role checks.
- Use `publishEvent()` when a mutation drives activity, notifications, integrations, or realtime updates.
- Keep web requests in `apps/web/src/fetchers/` and server state in TanStack Query hooks.
- Use the client from `@kaneo/libs`; do not create a parallel untyped request layer.
- Define database schema in `apps/api/src/database/schema.ts` and relations in `apps/api/src/database/relations.ts`.
- Generate migrations with `pnpm --filter @kaneo/api db:generate`, inspect the SQL, and include it with the schema change.
- `apps/docs/openapi.json` is a committed artifact that the docs site serves. Regenerate it with `pnpm openapi:check:fix` whenever a route, request schema, or response schema changes; CI fails when it drifts.
- Prefer inferred TypeScript types and `type` over `interface` unless extension or declaration merging is required.
- Comments should explain constraints or surprising decisions, not narrate code.

## Safety and tooling

- Use pnpm 10.32.1 and Node.js 20.19 or newer. Server environment variables come from the root `.env`; local Vite-only overrides belong in `apps/web/.env.local`. See `ENVIRONMENT_SETUP.md`.
- Never use production databases, storage, or credentials for development or tests.
- Preserve unrelated work in a dirty worktree. Do not delete data or generated files unless the task requires it and the target is verified.
- Track processes you start and stop only those processes; never kill by broad name or path patterns.
- The root and package `lint` scripts run Biome with `--write` and can modify unrelated files. Prefer targeted checks while iterating and inspect formatter changes.
- Do not commit, push, or open a pull request unless explicitly requested.

## Verification

Use the smallest proof that covers the changed behavior, then broaden it when the blast radius requires it.

- Utility or UI logic: focused unit/component tests and the affected package typecheck.
- API behavior: focused API tests; use integration tests when routing, authentication, authorization, or PostgreSQL behavior matters.
- Database changes: relevant integration tests and migration inspection.
- Cross-package contracts: typecheck or build all affected consumers.
- Realtime changes: verify the event-to-WebSocket-to-cache path and consider both in-memory and Redis delivery.
- Deployment changes: validate the affected Docker, Helm, or startup path.
- User-visible flows: use a real browser pass when requested or when it is the only meaningful proof.

Run repository-wide checks when a change crosses packages broadly, before a requested commit or pull request, or when explicitly asked. Report what ran and what did not.

## Releases

Releasing is manual and deliberate: dispatch the **Release** workflow from `main`. Nothing releases on a push.

The workflow resolves the next version from the Conventional Commits since the last tag, builds and pushes the three GHCR images under that version, validates the Helm chart, and only then cuts the release: `package.json`, `charts/kaneo/Chart.yaml`, `CHANGELOG.md`, the `vX.Y.Z` tag, a GitHub Release with grouped notes, and a "released in vX.Y.Z" comment on every PR and issue it closed. `:latest` and the chart publish come after that. A failed image build stops the release; it never leaves a tag pointing at an image that was never published.

Dispatch inputs: `release_type` (`auto` by default; `patch`/`minor`/`major` force the bump) and `dry_run`, which prints the version and notes to the job summary and stops.

This is why the commit convention matters:

- `feat:` → minor bump
- `fix:` / `perf:` → patch bump
- `feat!:` or a `BREAKING CHANGE:` footer → major bump
- `refactor:` / `docs:` → shown in the changelog, no bump on their own
- `test:` / `build:` / `ci:` / `chore:` / `style:` → no release, hidden from the notes

Notes are generated by `scripts/release/notes.mjs`, which maps every commit back to the pull request that landed it and collapses the range to one entry per pull request, so review churn like `fix: apply CodeRabbit auto-fixes` no longer reaches the notes. The entry text is the pull request title when its type matches the commit's, and the commit subject otherwise; both are public, so write them for the reader. Commits pushed straight to `main` have no pull request and fall back to a commit link. Pull request authors are credited by handle, bots excluded.

Preview any range before releasing:

```bash
node scripts/release/notes.mjs v2.21.0 HEAD
```

Version-carrying files are listed in `scripts/release/apply-version.mjs`. Add new ones there rather than in a workflow step, because the image build and the release commit both run that script.

## Glossary

- **instance**: one deployed Kaneo installation.
- **workspace**: the top-level collaboration and authorization boundary.
- **project**: a task container inside a workspace.
- **role**: a workspace-scoped set of permission statements.
- **activity**: durable, user-visible history.
- **event**: an internal notification used by activity, integrations, notifications, or realtime updates.

Update this guide only for recurring, observed failure modes. Put narrow workflows in skills or dedicated documentation.
