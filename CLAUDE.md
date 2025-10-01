# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Kaneo is a modern, self-hosted project management platform built as a monorepo with multiple applications and shared packages. The project uses PostgreSQL, Hono for the backend API, React with TanStack Router for the frontend, and is deployed via Docker and Kubernetes.

## Monorepo Structure

This is a **Turborepo monorepo** with the following organization:

### Applications (`apps/`)
- **`api/`** - Backend REST API built with Hono framework and TypeScript (runs on port 1337)
- **`web/`** - Frontend React application with Vite and TanStack Router (runs on port 5173)
- **`docs/`** - Documentation website built with Next.js and Fumadocs

### Packages (`packages/`)
- **`libs/`** - Shared TypeScript utilities and Hono extensions
- **`typescript-config/`** - Shared TypeScript configurations

## Common Commands

### Development
```bash
# Start all services in development mode
pnpm dev

# Start specific app
pnpm --filter @kaneo/api dev
pnpm --filter @kaneo/web dev
pnpm --filter @kaneo/docs dev
```

### Building
```bash
# Build all apps
pnpm build

# Build specific app
pnpm --filter @kaneo/api build
pnpm --filter @kaneo/web build
```

### Linting
```bash
# Lint all apps (using Biome)
pnpm lint

# Lint specific app
pnpm --filter @kaneo/api lint
```

### Database Operations
```bash
# Navigate to the API directory first
cd apps/api

# Generate new migration
pnpm db:generate

# Run migrations
pnpm db:migrate

# Open Drizzle Studio for database inspection
pnpm db:studio
```

### Testing Individual Changes
- Backend: Use `tsx watch src/index.ts` in `apps/api/` for hot-reload
- Frontend: Use `vite` in `apps/web/` for hot-reload
- Database: Use `drizzle-kit studio` to visually inspect database changes

## Architecture Patterns

### Backend API (`apps/api/`)

**Entry Point**: `apps/api/src/index.ts` - Main Hono application setup

**Domain-Driven Architecture**: Each feature domain follows a consistent structure:
```
src/{domain}/
├── controllers/          # HTTP request handlers
│   ├── create-{resource}.ts
│   ├── get-{resource}.ts
│   ├── update-{resource}.ts
│   └── delete-{resource}.ts
├── utils/               # Domain-specific utilities (optional)
└── index.ts            # Exports all routes as Hono app
```

**Key Domains**:
- `activity/` - Activity tracking and comments
- `task/` - Task management (CRUD, updates, exports)
- `project/` - Project management
- `workspace/` - Workspace management
- `user/` - Authentication and user management
- `github-integration/` - GitHub app integration
- `time-entry/` - Time tracking
- `notification/` - User notifications
- `label/` - Task labeling system

**Database**:
- Schema: `apps/api/src/database/schema.ts` - All Drizzle ORM table definitions
- Connection: `apps/api/src/database/index.ts`
- Migrations: `apps/api/drizzle/` directory
- Config: `apps/api/drizzle.config.ts`

**Authentication**:
- Configuration: `apps/api/src/auth.ts` - better-auth setup with plugins
- Methods supported:
  - Email/Password (built-in)
  - GitHub OAuth (via `socialProviders`)
  - OIDC/OpenID Connect (via `genericOAuth` plugin)
  - Anonymous mode (via `anonymous` plugin)
- Environment variables:
  - `OIDC_CLIENT_ID`, `OIDC_CLIENT_SECRET` - OIDC credentials
  - `OIDC_DISCOVERY_URL` - Auto-discovery endpoint (e.g., `https://auth.example.com/.well-known/openid-configuration`)
  - `OIDC_SCOPES` - OAuth scopes (default: `openid profile email`)
- Database tables: `user`, `account`, `session`, `verification` (see `schema.ts`)

### Frontend Web (`apps/web/`)

**Entry Point**: `apps/web/src/main.tsx` - React application root

**Routing**: Uses TanStack Router with file-based routing in `src/routes/`
- Root layout: `src/routes/__root.tsx`
- Dashboard: `src/routes/dashboard.tsx`
- Auto-generated route tree: `src/routeTree.gen.ts` (do not edit manually)

**Component Organization**:
```
src/components/
├── {feature}/          # Feature-specific components
├── ui/                 # Shadcn/ui components
├── common/             # Shared components (Editor, Logo, Sidebar)
└── providers/          # React context providers
```

**Key Features**:
- `kanban-board/` - Kanban board view for tasks
- `list-view/` - List view for tasks
- `backlog-list-view/` - Backlog view
- `task/` - Task detail components
- `project/` - Project management UI
- `team/` - Team management UI

**Data Management**:
- **TanStack Query**: Query client at `src/query-client/index.ts`
- **Fetchers**: Domain-specific API calls in `src/fetchers/`
- **Hooks**:
  - Queries: `src/hooks/queries/`
  - Mutations: `src/hooks/mutations/`
- **Zustand Stores**: Client state in `src/store/` (project, workspace, user preferences)

**Types**: Organized by domain in `src/types/`

## Environment Configuration

### Development Setup
```bash
# Copy environment templates
cp apps/api/.env.sample apps/api/.env
cp apps/web/.env.sample apps/web/.env
```

### Required API Environment Variables (`apps/api/.env`)
- `DATABASE_URL` - PostgreSQL connection string (e.g., `postgresql://kaneo_user:kaneo_password@localhost:5432/kaneo`)
- `JWT_ACCESS` - Secret key for JWT token generation

### Required Frontend Environment Variables (`apps/web/.env`)
- `VITE_API_URL` - URL of the API server (e.g., `http://localhost:1337`)

See `ENVIRONMENT_SETUP.md` for detailed configuration and CORS troubleshooting.

## Coding Conventions

### File Naming
- **kebab-case** for directories and files: `github-integration/`, `create-task.ts`
- **PascalCase** for React components: `TaskCard.tsx`, `SignInForm.tsx`

### Backend Conventions
- Controllers follow `{action}-{resource}.ts` pattern (e.g., `create-task.ts`, `get-project.ts`)
- Each domain module exports routes via `index.ts`
- Use Drizzle ORM for all database operations

### Frontend Conventions
- Components organized by feature
- Custom hooks in `hooks/mutations/` and `hooks/queries/`
- API calls in `fetchers/` organized by domain
- Type definitions in `types/` organized by domain

### Import Organization
1. External libraries (React, Hono, etc.)
2. Internal shared packages (@kaneo/libs)
3. Relative imports (./components, ../utils)

### Commit Messages
Follow Conventional Commits:
- `feat:` new features
- `fix:` bug fixes
- `docs:` documentation changes
- `style:` formatting changes
- `refactor:` code refactoring
- `test:` adding tests
- `chore:` maintenance tasks

## Database Operations

### Working with Schema Changes
1. Modify schema in `apps/api/src/database/schema.ts`
2. Generate migration: `cd apps/api && pnpm db:generate`
3. Review generated migration in `apps/api/drizzle/`
4. Apply migration: `pnpm db:migrate`
5. Test changes using Drizzle Studio: `pnpm db:studio`

### Drizzle ORM Patterns
```typescript
import { db } from './database'
import { tasks, projects } from './database/schema'
import { eq } from 'drizzle-orm'

// Type-safe queries
const userTasks = await db
  .select()
  .from(tasks)
  .where(eq(tasks.userId, userId))
```

## Key Technologies

- **Backend**: Hono, TypeScript, Drizzle ORM, PostgreSQL, better-auth
- **Frontend**: React 19, Vite, TanStack Router, TanStack Query, Tailwind CSS 4, Shadcn/ui
- **Database**: PostgreSQL 12+ with Drizzle ORM
- **Deployment**: Docker (multi-stage builds), Kubernetes (Helm charts in `charts/kaneo/`)
- **Monorepo**: Turborepo with pnpm workspaces
- **Code Quality**: Biome for linting/formatting, Commitlint for commit messages

## Deployment

### Docker
- API Dockerfile: `apps/api/Dockerfile`
- Web Dockerfile: `apps/web/Dockerfile`
- Multi-stage builds for optimized production images

### Kubernetes
- Helm chart located in `charts/kaneo/`
- Deploy: `helm install kaneo ./charts/kaneo --namespace kaneo --create-namespace`
- Values: `charts/kaneo/values.yaml`

## Important Notes

- **PostgreSQL is required** - The project migrated from SQLite to PostgreSQL
- **Port 1337** is the default API port
- **Port 5173** is the default web development port
- **CORS issues** are common - see `ENVIRONMENT_SETUP.md` for troubleshooting
- **Route tree is auto-generated** - Don't manually edit `src/routeTree.gen.ts` in the web app
- **Database migrations** must be run before starting the API in development
