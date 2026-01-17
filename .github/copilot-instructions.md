# Copilot Instructions for Kaneo

## Project Overview
- **Kaneo** is a self-hosted project management platform focused on simplicity and performance.
- The codebase is a **pnpm monorepo** managed with TurboRepo. Major apps: `api` (backend), `web` (frontend), and shared `packages/` and `libs/`.
- Data flows through a PostgreSQL database, with the API as the main service boundary. The web app communicates with the API over HTTP.

## Key Directories
- `apps/api/`: Node.js backend (TypeScript, Drizzle ORM, PostgreSQL)
- `apps/web/`: Frontend (TypeScript, React, Vite)
- `charts/kaneo/`: Helm chart for Kubernetes deployments
- `compose.yml`: Docker Compose for local/dev
- `packages/`, `libs/`: Shared code and utilities

## Development Workflows
- **Install dependencies:** `pnpm install`
- **Start all dev servers:** `pnpm dev`
- **Lint (Biome):** `pnpm lint`
- **Build all packages:** `pnpm build`
- **API dev only:** `pnpm --filter @kaneo/api dev`
- **Web dev only:** `pnpm --filter @kaneo/web dev`
- **Database migrations:**
  - Generate: `pnpm --filter @kaneo/api db:generate`
  - Migrate: `pnpm --filter @kaneo/api db:migrate`

## Deployment Patterns
- **Docker Compose:**
  - Main config: `compose.yml`
  - Use `.env` for secrets/config
  - Health checks and `depends_on` for service readiness
- **Kubernetes:**
  - Use Helm chart in `charts/kaneo/`
  - See `charts/kaneo/README.md` for production config

## Project Conventions
- **Keep solutions simple and focused.** Avoid over-engineering and unnecessary features.
- **Do not add features or refactorings unless explicitly requested.**
- **Environment variables** are always loaded from `.env` (never hardcoded).
- **Database schema changes** require migration scripts in `apps/api/drizzle/`.
- **Persistent data** uses named Docker volumes or Kubernetes PVCs.

## Integration Points
- **API**: Exposes HTTP endpoints for all core features
- **Web**: Consumes API, no direct DB access
- **Email**: Handled via `packages/email/`
- **External integrations** (e.g., GitHub): See `apps/api/src/github-integration/`

## Examples
- To add a new API route: see `apps/api/src/` for structure and patterns
- To add a frontend feature: see `apps/web/src/`
- For deployment: reference `compose.yml` or `charts/kaneo/`

---
For more, see the main [README.md] `.\README.md` and [Helm chart docs] `.\charts\kaneo\README.md`


## Agent Implementation (Planned)

### Cloudflare Workers Agent Standards

- Agents should be implemented as Cloudflare Workers using TypeScript and ES modules.
- Follow the code, configuration, and security guidelines in AGENT.md:
  - Use TypeScript with explicit types and interfaces.
  - Import all used methods, classes, and types.
  - Use a single file unless otherwise required.
  - Prefer official SDKs for Cloudflare services (KV, Durable Objects, D1, R2, Queues, Vectorize, Analytics Engine, Workers AI, Browser Rendering, Static Assets, Hyperdrive).
  - Provide a complete wrangler.jsonc with all required bindings, environment variables, and compatibility flags.
  - Set compatibility_date = "2025-03-07" and compatibility_flags = ["nodejs_compat"].
  - Enable observability in wrangler.jsonc.
  - Never hardcode secrets; use environment variables.
  - Implement request validation, security headers, CORS, and rate limiting as needed.
  - Use the Durable Objects WebSocket Hibernation API for WebSocket support.
  - Prefer the `agents` package for building AI agents, using `this.setState` for state and `this.sql` for direct queries.
  - For frontend integration, use the `useAgent` React hook from `agents/react`.
  - Include error handling, logging, and comments for complex logic.
  - Provide test examples and curl commands for API endpoints.

See AGENT.md for detailed examples and patterns. Update both this file and AGENT.md as agent features evolve.
