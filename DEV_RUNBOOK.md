# Development runbook

Host-native dev: API, web, and a local PostgreSQL container run directly on the
machine; only the database is containerized. Use this instead of
`compose.local.yml` for day-to-day work, because Compose rebuilds images on every
change.

For the full environment reference (OAuth, SMTP, S3, Redis, CAPTCHA), see
[ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md). This file is the short operational
checklist.

## Prerequisites

- Node `^24.15.0 || >=26.0.0` and pnpm `12.15.0`.
- Docker for the PostgreSQL container.
- Ports `1337` (API) and `5173` (web) free.

```sh
node -v && pnpm -v
```

## One-time setup

### 1. PostgreSQL

Reuse the existing container if it is still there:

```sh
docker start kaneo-dev-pg
```

Otherwise create it (credentials must match your `.env`):

```sh
docker run -d --name kaneo-dev-pg \
  -e POSTGRES_DB=kaneo \
  -e POSTGRES_USER=kaneo \
  -e POSTGRES_PASSWORD=YOUR_LOCAL_PASSWORD \
  -p 127.0.0.1:5432:5432 \
  postgres:16-alpine
```

Check readiness:

```sh
docker exec kaneo-dev-pg pg_isready -U kaneo -d kaneo
```

A container created without `-v` keeps data only for the container's lifetime.
That is fine for throwaway dev data; add a named volume if you want it to survive
`docker rm`.

### 2. Root `.env`

The API reads the root `.env` (gitignored). Copy `.env.sample` and set at least:

```env
KANEO_CLIENT_URL=http://localhost:5173
KANEO_API_URL=http://localhost:1337
DATABASE_URL=postgresql://kaneo:YOUR_LOCAL_PASSWORD@localhost:5432/kaneo
AUTH_SECRET=<output of: openssl rand -hex 32>
```

Rules that cause most setup failures:

- `AUTH_SECRET` must be non-empty and at least 32 characters. Generate it once
  and keep it stable; changing it invalidates existing sessions. The sample file
  ships this key **empty**, which makes the API exit with
  `AUTH_SECRET is not set`.
- Use `localhost` in `DATABASE_URL` for a host-native API. Hostname `postgres`
  only resolves inside a Compose network.
- An explicit `DATABASE_URL` wins over `POSTGRES_*`. Only set `POSTGRES_HOST`,
  `POSTGRES_PORT`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB` if you
  prefer derived config, and then set `POSTGRES_HOST=localhost`.
- If the container was started once with a different password, PostgreSQL keeps
  the old one in its data directory and ignores the new `POSTGRES_PASSWORD`.
  Recreate the container (or its volume) when credentials change.

### 3. Dependencies and workspace builds

```sh
pnpm install
pnpm build:dependencies
```

`pnpm build:dependencies` prints
`No packages matched the filter: @kaneo/*^...` and exits 0 with the current
Vite+ filter semantics, so nothing gets built. A fresh clone also has no
`packages/*/dist`. `vp run ... build` fails here with
`process.execve failed with error code EBUSY` at `tsc`, but running `tsc`
directly works, so build the packages like this:

```sh
for p in permissions email importers editor mcp; do
  (cd packages/$p && ../../node_modules/.bin/tsc --noEmit false) || exit 1
done
```

`@kaneo/libs` is source-only (no build step).

## Daily start

Start PostgreSQL first, then the apps.

Run only API and web (recommended while working on the app):

```sh
pnpm --filter @kaneo/api dev    # terminal 1, http://localhost:1337
pnpm --filter @kaneo/web dev    # terminal 2, http://localhost:5173
```

Run every workspace package that defines a `dev` script (`api`, `web`, `site`,
`email` preview, `mcp`, `cli`):

```sh
pnpm dev
```

The API applies committed migrations and runs startup checks itself; a fresh
database is created and migrated automatically.

### Run in the background (agent/CI style)

When the terminal is not yours, redirect logs and keep the PIDs:

```sh
mkdir -p /tmp/opencode/kaneo-dev
nohup pnpm --filter @kaneo/api dev > /tmp/opencode/kaneo-dev/api.log 2>&1 &
nohup pnpm --filter @kaneo/web dev > /tmp/opencode/kaneo-dev/web.log 2>&1 &
```

### Verify

```sh
curl --fail -s http://localhost:1337/api/health   # {"status":"ok"}
curl -o /dev/null -w '%{http_code}\n' http://localhost:5173/
```

The first non-guest account completes instance setup. Keep the instance private
until that account exists.

## Tests

Use pnpm for the inner loop. Docker Compose is only for the E2E stack.

| Scope | Command | Needs |
| --- | --- | --- |
| Unit tests (all projects) | `pnpm test` | nothing |
| One unit test file | `pnpm exec vp test run <path/to/file.test.ts>` | nothing |
| API integration | `pnpm test:integration` | local PostgreSQL |
| One integration file | `pnpm --filter @kaneo/api exec vp test run --config vitest.integration.config.ts ../../tests/api-integration/<file>.test.ts` | local PostgreSQL |
| Browser E2E | see below | Docker Compose |

- Web unit tests under Node 24 need
  `NODE_OPTIONS=--no-experimental-webstorage` so jsdom owns browser storage.
- Integration setup uses `DATABASE_URL` from the environment or root `.env`,
  derives a `<name>_test` database, creates it if needed, and migrates it. The URL
  must point at a `_test` database or the suite refuses to run. Never point it at
  a database with real data.
- E2E runs against its own disposable stack on `http://localhost:18173`, not
  against the dev instance:

  ```sh
  pnpm --dir tests/e2e install
  docker compose -f tests/e2e/compose.yml up --build --wait --wait-timeout 180
  pnpm test:e2e
  docker compose -f tests/e2e/compose.yml down --volumes
  ```

  Always tear the stack down, including after failed runs. Do not run two copies
  at once.

## Stop

Stop the dev processes you started (Ctrl-C, or `kill <pid>` for background runs),
then optionally the database:

```sh
docker stop kaneo-dev-pg
```

## Troubleshooting

| Symptom | Check |
| --- | --- |
| `AUTH_SECRET is not set` on API start | Root `.env` exists and `AUTH_SECRET` is non-empty; restart the API after editing `.env` (tsx watch does not reload env). |
| API cannot reach the database | `docker exec kaneo-dev-pg pg_isready -U kaneo -d kaneo`, and that `DATABASE_URL` uses `localhost`, not `postgres`. |
| `password authentication failed` | URL password matches the password the container was **first** initialized with; recreate the container/volume if not. |
| `EADDRINUSE` on 1337 or 5173 | A previous dev process is still running: `ss -ltnp \| grep -E ':(1337\|5173)'`, then stop that PID. |
| API started but 1337 is not listening yet | Startup runs migrations and integration migrations on the first boot; follow the log until `API is running at http://localhost:1337`. |
| `process.execve failed with error code EBUSY` | `vp run` cannot exec the TypeScript 7 binary in this environment; run `../../node_modules/.bin/tsc --noEmit false` in the package instead (see setup step 3). |
| Browser hits the wrong API | Set `VITE_API_URL` in `apps/web/.env.local` (public values only), then restart Vite. |
| Session drops after restart | `AUTH_SECRET` changed; keep one stable value. |