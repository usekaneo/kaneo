# Local development setup

Use Node.js 24 or newer and pnpm 10.32.1, as declared in the root `package.json`. You also need a local PostgreSQL database. Redis and object storage are optional.

## Configure the API

Create `.env` in the repository root. If you copy `.env.sample`, replace its empty secrets and choose a database address that the API can reach.

```env
KANEO_CLIENT_URL=http://localhost:5173
KANEO_API_URL=http://localhost:1337
DATABASE_URL=postgresql://kaneo:YOUR_LOCAL_PASSWORD@localhost:5432/kaneo
AUTH_SECRET=REPLACE_WITH_A_RANDOM_SECRET
```

Generate the authentication secret with `openssl rand -hex 32`. Keep it stable between runs. It protects authentication.

Create the database and user before starting the API. The API applies committed migrations at startup. Use a development database, never a production database.

An explicit `DATABASE_URL` takes precedence over `POSTGRES_*`. You do not need both. If you choose derived configuration, set `POSTGRES_PASSWORD` and `POSTGRES_HOST=localhost` for a host-native API. The default hostname `postgres` is for containers sharing a Compose network. `POSTGRES_DB` and `POSTGRES_USER` alone do not enable derivation.

The bundled Docker image derives `KANEO_API_URL` from `KANEO_CLIENT_URL`. Host-native development does not run that entrypoint, so set the two URLs explicitly as above.

## Configure the browser

The API reads the root `.env`. Vite reads frontend overrides from `apps/web/.env.local`.

The default development API address is `http://localhost:1337`. To change it, create:

```env
# apps/web/.env.local
VITE_API_URL=http://localhost:1337
```

Only put public browser configuration in `VITE_*` variables. Never put database passwords, API keys, or provider secrets there. Restart Vite after changing the file.

The production containers use different names: their startup script replaces `KANEO_API_URL`, `KANEO_CLIENT_URL`, and `KANEO_TURNSTILE_SITE_KEY` in the built assets. Editing `VITE_API_URL` in a running container does not change its API address.

## Install and start

From the repository root:

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173. Check API readiness separately:

```bash
curl --fail http://localhost:1337/api/health
```

The first non-guest account completes instance setup. Keep this local instance private until you have created it.

## Optional features

Use the [environment reference](https://kaneo.app/docs/core/installation/environment-variables) for server settings and defaults.

- **Uploads:** configure S3-compatible storage. [Silo](https://kaneo.app/docs/core/installation/silo) is the documented self-hosted option. The API and browser must both reach its endpoint.
- **Email:** configure SMTP. Email verification codes become the default sign-in method; `DISABLE_EMAIL_OTP_SIGN_IN=true` keeps password sign-in. Invitations and password resets still use SMTP.
- **Sign-in providers:** configure OAuth credentials on the API and register the local callback URL with the provider.
- **MCP:** the built-in endpoint uses `KANEO_INTERNAL_API_URL`, defaulting to `http://127.0.0.1:1337`, for internal tool requests. Device authorization allows `kaneo-cli` and `kaneo-mcp` by default.
- **Private-network connections:** `KANEO_ALLOW_PRIVATE_WEBHOOK_DESTINATIONS=true` permits internal ntfy, Gotify, webhook, Gitea, and GitLab destinations. Only enable it on a trusted deployment.
- **Redis:** only needed to relay live updates between multiple API instances. Leave it unset for one local API process.
- **CAPTCHA:** set `TURNSTILE_SECRET_KEY` in the root `.env` and the matching `VITE_TURNSTILE_SITE_KEY` in `apps/web/.env.local`. The secret enables verification independently of cloud mode. Configure a widget that accepts your development hostname.
- **Sentry:** `SENTRY_DSN` enables API reporting. A browser build reads `VITE_SENTRY_DSN`; the current container renderer does not substitute `KANEO_SENTRY_DSN` at runtime. Leave reporting unset if you do not need it.

After initial setup, when `DISABLE_REGISTRATION=true`, sign-in emails (OTP codes and magic links) are only sent to addresses that already have an account or hold a pending workspace invitation; unknown addresses get a generic success response with no email. When `DISABLE_PASSWORD_REGISTRATION=true`, only existing accounts receive them. An empty instance with `DISABLE_REGISTRATION=true` still accepts sign-in emails for any address until the first non-guest account is created.

Sign-in email eligibility checks and delivery run in the API process after the request is accepted, so the response does not wait for SMTP. Pending sends are given up to 10 seconds to finish during graceful shutdown; they are not persisted across a process crash.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| API cannot resolve `postgres` | Use `localhost` in the database URL when the API runs on your host. |
| Database authentication fails | Confirm the database exists and the URL matches its actual user and password. |
| Browser requests reach the wrong API | Check `apps/web/.env.local`, then restart Vite. |
| CORS or WebSocket origin error | Set `KANEO_CLIENT_URL` to the exact browser origin. Put additional allowed origins in the comma-separated `CORS_ORIGINS` value. |
| OAuth returns to the wrong address | Check `KANEO_API_URL` and the provider callback URL. |
| Sign-in breaks after restarting | Keep `AUTH_SECRET` unchanged and ensure every API process uses the same value. |
| Upload URL cannot be reached | Use an endpoint the browser can resolve, not a Docker-only storage hostname. |

For deployed instances, use the [self-hosting guide](https://kaneo.app/docs/core/installation) and [operations troubleshooting](https://kaneo.app/docs/core/operations/troubleshooting).
