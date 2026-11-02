# API integration tests

These tests boot the Hono app with a real PostgreSQL database (see `setup.ts` for env defaults).

- Run: `pnpm test:integration` from the repo root (requires Postgres and `DATABASE_URL`).
- CI: `.github/workflows/ci.yml` starts Postgres and runs the same command.

Coverage is intentionally incremental: add new files under this directory for additional routes or behaviors, following existing helpers (`helpers/fixtures.ts`, `helpers/database.ts`, `helpers/auth.ts`).

`agent-coding-wrapper-http.test.ts` also requires Git. It runs the real CI wrapper against loopback HTTP callbacks, signed fixture OIDC identities, temporary Git repositories, and PostgreSQL. The coding editor and GitHub API use fixtures; no model keys, GitHub credentials, or external services are needed. The suite is included in the normal integration command.
