# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kaneo is a self-hosted project management platform built with simplicity and performance as core principles. The codebase is organized as a **pnpm monorepo** with TurboRepo.

**Key Philosophy**: Features exist to solve real problems, not to impress. Avoid over-engineering - keep solutions simple and focused. Don't add features, refactoring, or improvements beyond what was asked.

## Development Commands

### Getting Started
```bash
# Install dependencies (uses pnpm)
pnpm install

# Start all development servers (API + web)
pnpm dev

# Lint and auto-fix code (Biome)
pnpm lint

# Build all packages
pnpm build
```

### API-Specific Commands
```bash
# Run API in development mode
pnpm --filter @kaneo/api dev

# Build API
pnpm --filter @kaneo/api build

# Generate database migrations (after schema changes)
pnpm --filter @kaneo/api db:generate

# Run database migrations (auto-runs on API startup)
pnpm --filter @kaneo/api db:migrate

# Open Drizzle Studio (database GUI)
pnpm --filter @kaneo/api db:studio

# Lint API code
pnpm --filter @kaneo/api lint
```

### Web-Specific Commands
```bash
# Run web app in development mode
pnpm --filter @kaneo/web dev

# Build web app for production
pnpm --filter @kaneo/web build

# Preview production build
pnpm --filter @kaneo/web preview

# Lint web code
pnpm --filter @kaneo/web lint
```

## Architecture Overview

### Monorepo Structure
```
kaneo/
├── apps/
│   ├── api/          # Backend API (Hono/Node.js/PostgreSQL)
│   ├── web/          # Frontend app (React/Vite/TanStack)
│   └── docs/         # Documentation site (Next.js)
├── packages/
│   ├── email/        # Email utilities
│   ├── libs/         # Shared libraries
│   └── typescript-config/  # TypeScript configurations
└── charts/           # Kubernetes Helm charts
```

### Technology Stack

**Backend (API)**
- Framework: Hono (lightweight web framework)
- Database: PostgreSQL with Drizzle ORM
- Authentication: Better Auth
- Validation: Valibot
- API Documentation: OpenAPI (hono-openapi)
- IDs: CUID2 (via @paralleldrive/cuid2)

**Frontend (Web)**
- Framework: React 19+
- Routing: TanStack Router (file-based)
- Data Fetching: TanStack Query (React Query)
- Build Tool: Vite
- Styling: Tailwind CSS v4
- State Management: Zustand
- UI Components: Radix UI primitives

### Key Architectural Patterns

**Backend API Structure**
- Routes organized by feature in `apps/api/src/{feature}/`
- Controller pattern: business logic extracted to `{feature}/controllers/`
- All routes use OpenAPI decorators (`describeRoute`)
- All inputs validated with Valibot schemas
- Migrations auto-run on API startup

**Frontend Structure**
- File-based routing in `apps/web/src/routes/`
- Query hooks in `apps/web/src/hooks/queries/`
- Mutation hooks in `apps/web/src/hooks/mutations/`
- API fetchers in `apps/web/src/fetchers/{feature}/`
- Components in `apps/web/src/components/`

**Database Schema Conventions**
- All tables use CUID2 for primary keys (`createId()`)
- Every table has `createdAt` and `updatedAt` timestamps
- Foreign keys always specify cascade behavior (`onDelete`, `onUpdate`)
- Indexes on frequently queried columns (especially foreign keys)
- Schema defined in `apps/api/src/database/schema.ts`
- Relations defined in `apps/api/src/database/relations.ts`

**Authentication Flow**
- Better Auth handles authentication
- User context available in Hono via `c.get("userId")`, `c.get("user")`, `c.get("session")`
- API keys supported via Bearer token
- Frontend uses Better Auth client from `@/lib/auth-client`

**Event System**
- Events published for activity tracking
- Use `publishEvent()` from `apps/api/src/events/`
- Events tracked for features like status changes, assignments, etc.

## Code Style

### Formatting (Biome)
- **Indentation**: Tabs for TypeScript/TSX
- **Quotes**: Double quotes
- **Semicolons**: Required
- Run `pnpm lint` to auto-fix

### TypeScript Conventions
- Prefer `type` over `interface` (only use interface when extending/merging)
- Prefer type inference when obvious
- File naming: PascalCase for components, kebab-case for utilities/hooks
- Hooks use `use` prefix: `use-task.ts`

### Import Organization
1. External packages
2. Internal packages (`@/` aliases)
3. Relative imports
Biome auto-organizes imports.

### Git Commits
Use Conventional Commits:
- `feat:` - New features
- `fix:` - Bug fixes
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `chore:` - Maintenance tasks

Husky enforces commit message format via commitlint.

## Environment Configuration

**Single `.env` file** in project root shared by all apps.

Required variables:
- `KANEO_CLIENT_URL` - Web app URL (e.g., http://localhost:5173)
- `KANEO_API_URL` - API URL (e.g., http://localhost:1337)
- `AUTH_SECRET` - JWT secret (min 32 chars)
- `DATABASE_URL` - PostgreSQL connection string
- `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`

Optional:
- `CORS_ORIGINS` - Comma-separated allowed origins (empty = allow all in dev)
- `VITE_API_URL` - API URL for web dev (defaults to http://localhost:1337)
- SSO providers (GitHub, Google, Discord, Custom OAuth/OIDC)
- SMTP configuration

See `ENVIRONMENT_SETUP.md` for detailed configuration and troubleshooting.

## Development Workflow

### When Making Changes

1. **Read before modifying**: Never propose changes to code you haven't read
2. **Use existing patterns**: Follow the established controller/fetcher/hook patterns
3. **Avoid over-engineering**: Don't add features beyond what's requested
4. **Type safety**: Let TypeScript guide you - all APIs are fully typed
5. **Validate inputs**: Always use Valibot schemas for API inputs
6. **Error handling**: Backend uses HTTPException, frontend uses toast notifications

### Database Changes

1. Modify schema in `apps/api/src/database/schema.ts`
2. Generate migration: `pnpm --filter @kaneo/api db:generate`
3. Migration auto-runs on next API startup
4. Always use CUID2 for IDs, include timestamps, specify cascade behavior

### Adding API Endpoints

1. Create controller in `apps/api/src/{feature}/controllers/`
2. Add route in `apps/api/src/{feature}/index.ts`
3. Use `describeRoute` for OpenAPI docs
4. Use `validator` with Valibot schema
5. Keep route handler thin - business logic in controller

### Adding Frontend Features

1. Create fetcher in `apps/web/src/fetchers/{feature}/`
2. Create query/mutation hook in `apps/web/src/hooks/`
3. Use TanStack Query for caching
4. Handle loading/error states properly
5. Use toast notifications (sonner) for user feedback

## Important Notes

- **Package Manager**: This project uses **pnpm**, not npm or yarn
- **Migrations**: Auto-run on API startup, stored in `apps/api/drizzle/`
- **Development Ports**: API runs on 1337, web runs on 5173
- **Hot Reload**: Both API and web have watch mode via `pnpm dev`
- **CORS**: Configured in API index.ts, controlled by `CORS_ORIGINS` env var
- **No Tests Yet**: Test infrastructure not currently set up in this codebase
- **Security**: Never commit secrets, always validate inputs, sanitize outputs

## Common Patterns

### Backend Route Example
```typescript
// apps/api/src/{feature}/index.ts
import { Hono } from "hono";
import { describeRoute, validator } from "hono-openapi";
import * as v from "valibot";
import getItem from "./controllers/get-item";

const feature = new Hono<{ Variables: { userId: string } }>()
  .get("/:id",
    describeRoute({
      operationId: "getItem",
      tags: ["Feature"],
      description: "Get item by ID"
    }),
    validator("param", v.object({ id: v.string() })),
    async (c) => {
      const { id } = c.req.valid("param");
      const item = await getItem(id);
      return c.json(item);
    }
  );
```

### Frontend Query Hook Example
```typescript
// apps/web/src/hooks/queries/{feature}/use-item.ts
import { useQuery } from "@tanstack/react-query";
import { getItem } from "@/fetchers/{feature}/get-item";

export function useItem(itemId: string) {
  return useQuery({
    queryKey: ["item", itemId],
    queryFn: () => getItem(itemId),
  });
}
```

### Database Schema Example
```typescript
// apps/api/src/database/schema.ts
export const exampleTable = pgTable("example", {
  id: text("id").$defaultFn(() => createId()).primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => projectTable.id, {
      onDelete: "cascade",
      onUpdate: "cascade",
    }),
  title: text("title").notNull(),
  createdAt: timestamp("created_at", { mode: "date" }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { mode: "date" })
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
}, (table) => [
  index("example_projectId_idx").on(table.projectId),
]);
```
