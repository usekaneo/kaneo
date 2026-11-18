# Sprint Planning for Kaneo — Gap Analysis

This document contrasts the current capability of Kaneo with the target sprint planning capability described in the feature list. The target behaviour is modelled on Jira sprint management. Unlike the initial draft, which relied on public information, this version was verified against the actual codebase.

## 1. Current State of Kaneo

Kaneo is a fast, simple, self-hosted project manager. The Hono API owns domain behavior and authorization; the React app uses its typed client. PostgreSQL stores durable state, events and WebSockets keep clients current, and Redis is optional for delivery across API instances.

The current planning capability includes:

| Area | Current Capability |
|------|--------------------|
| Views | Kanban board, list view, backlog view, Gantt chart, and calendar view. |
| Task model | Tasks with assignees, due dates, start dates, priorities, labels, subtasks, per-project ticket numbers, and custom fields. Tasks have a status (a column slug) plus the virtual statuses planned and archived. |
| Workflow | Custom columns with optional final (done) states, workflow rules driven by repository activity, and per-column capacity. |
| Realtime | An internal event bus (publishEvent) with WebSocket delivery per project, and React Query cache invalidation on the client. |
| Identity | Better Auth with workspaces, workspace roles seeded from a permission vocabulary (project, task, label, workspace statements), project access control, and SSO. |
| Integrations | Two-way GitHub and Gitea issue sync, GitLab and Jira integrations, chat integrations, project webhooks, a typed REST API, and MCP for AI assistants. |
| Persistence | PostgreSQL through Drizzle ORM with generated, journaled migrations. |

Directly relevant observations:

1. No sprint concept exists anywhere in the schema; the task table has no sprint reference and no type attribute.
2. The backlog is a virtual status (planned) rendered by the dedicated backlog route; it is not a routing target with default rules.
3. Task completion is defined by the task's column being final (taskIsCompleted), which gives the sprint close workflow a precise definition of unfinished work.
4. The permission vocabulary is fixed per workspace role rows; adding a new statement would require migrating every workspace's editable role rows.

## 2. Gap Overview

| # | Gap Area | Gap Severity | Summary |
|---|----------|---------------|---------|
| G1 | Sprint data model | Critical | No sprint entity, no sprint status, no sprint ordering, and no task-to-sprint relation exist. |
| G2 | Sprint lifecycle | Critical | No create, start, close, rename, or reorder operations exist. |
| G3 | Task assignment semantics | Critical | Tasks have no sprint field; the backlog is only a view, not a default container with routing rules. |
| G4 | Type-based default routing | High | Verified: no task type attribute exists; one is required so that bugs can default to the active sprint while other types default to the backlog. |
| G5 | Project settings for sprints | High | No project-level sprint settings exist, including the default sprint length in days. |
| G6 | Sprint close workflow | Critical | No mechanism exists to close a sprint, select a target, and move unfinished tasks while completed tasks remain in the closed sprint as history. |
| G7 | Implementation history | High | No read-only sprint history section exists. |
| G8 | Permissions | Medium | A dedicated manage-sprints statement would require migrating every workspace role row; the first release reuses the project update permission instead. |
| G9 | API parity | Medium | No sprint endpoints exist in the typed REST API. |
| G10 | Realtime delivery | Medium | Sprint changes need an event type and a WebSocket broadcast so clients refresh. |
| G11 | Integration safety | Medium | The GitHub, Gitea, and GitLab two-way sync must tolerate the new task fields without conflicts, since those hosts have no sprint equivalent. |
| G12 | Migration and rollout | Medium | Existing installations must migrate the schema and gain a functioning default state without a forced re-planning of all tasks. |

## 3. Detailed Gap Analysis

### G1. Sprint Data Model — Critical

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| Entity | No sprint concept exists anywhere in the schema. | A sprint table per project with name, goal, start date, end date, status (future, active, closed), and a position column for ordering, plus a partial unique index that allows at most one active sprint per project. |
| Task relation | Tasks reference projects, columns, and assignees only. | A nullable sprint reference on each task; null means backlog. The reference sets null on sprint deletion, like the column reference. |
| Ordering | Column and board positions exist; sprint order does not. | Manual position ordering for future sprints, reordering permitted only before start. |

### G2. Sprint Lifecycle — Critical

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| Create and edit | Not present. | Create future sprints with an optional goal and dates; rename and edit future sprints freely; edit the goal and end date of the active sprint only. |
| Start | Not present. | Start a future sprint; exactly one active sprint per project; the start date defaults to today and the end date to the default length. |
| Close | Not present. | Close the active sprint through a wizard that moves unfinished tasks to a chosen future sprint or the backlog and leaves completed tasks in place. |
| Jira reference | Jira gates these operations behind the Manage Sprints permission and makes closed sprints read-only. | The same guardrails apply. |

### G3. Task Assignment Semantics — Critical

| Aspect | Current State | Target State |
|--------|---------------|--------------|
| Default target | New tasks are created in a named column or the planned virtual status, without routing logic. | Bugs default to the active sprint when one exists; all other types default to the backlog. An explicit sprint in the create request overrides the default. |
| Editable targets | Not applicable today. | Tasks may be reassigned only among the active sprint, future sprints, and the backlog; tasks inside a closed sprint keep their assignment, so the history stays intact. |
| Bulk operations | A bulk task endpoint exists for status, priority, assignee, labels, due date, and delete; it has no sprint operation. | A bulk sprint operation follows the same pattern: the selection moves to the active sprint, a future sprint, or the backlog in one action, guarded by the same assignment rules as single-task moves. |

### G4. Type-Based Default Routing — High

Labels are user-defined and cannot reliably distinguish bugs from other work. A first-party task type attribute (bug, task) is required. The repository integrations map host issues to Kaneo tasks; issue type mapping can follow later, so synced issues initially default to the general type and land in the backlog, which is safe.

### G5. Project Settings for Sprints — High

The project table and update path exist; the required additions are the default sprint length in days (a positive integer with a sensible default), which drives end-date prefilling at sprint start, exposed through the existing project update endpoint and response.

### G6. Sprint Close Workflow — Critical

Nothing today corresponds to the Jira Complete Sprint dialog. The target workflow requires a summary of completed and unfinished tasks, a mandatory selection of the target sprint or the backlog for unfinished tasks, and a transactional move so that no task is lost or duplicated. Kaneo's taskIsCompleted expression (final column) provides the exact definition of unfinished.

### G7. Implementation History — High

Kaneo retains tasks and their activity, but it has no grouping of work by iteration. The target state keeps every closed sprint with its completed tasks in a collapsed, read-only history section, which satisfies the requested history of implementation.

### G8. Permissions — Medium

The permission vocabulary is defined in packages/permissions and seeded per workspace as editable role rows. Adding a sprint statement would leave existing workspaces without the new permission until each role row is edited. The first release therefore reuses project update for sprint lifecycle operations and task update for assignment changes, both of which every admin and owner role already carries. A dedicated statement can be introduced with a backfill in a later release.

### G9. API Parity — Medium

The typed REST API has no sprint resources. Sprint operations must be added with the same authentication, workspace access middleware, and OpenAPI documentation as other endpoints, which automatically extends the typed Hono client used by the web app.

### G10. Realtime Delivery — Medium

The event bus and WebSocket layer are in place. Sprint mutations must publish a sprint event that broadcasts to the project room, and task sprint changes must trigger the existing task board refresh path.

### G11. Integration Safety — Medium

The repository integrations synchronise titles, descriptions, comments, statuses, and labels in both directions. Because GitHub, Gitea, and GitLab have no sprint equivalent, the sprint and type fields must be excluded from sync payloads to prevent conflicts. Verified: the sync code writes explicit fields, so new columns are ignored by default.

### G12. Migration and Rollout — Medium

A Drizzle migration must add the sprint table and the task columns without touching existing data. Existing tasks default to a null sprint, which is the backlog, matching the requested behaviour. A fallback must keep projects that do not use sprints fully functional.

## 4. Reusable Foundations

| Capability | Reuse |
|------------|-------|
| Drizzle ORM migrations | Schema changes for sprints and task columns follow the existing migration pattern. |
| OpenAPI-typed routes | Sprint endpoints use createRoute with Zod schemas, workspace access middleware, and permission middleware. |
| Event bus and WebSockets | Sprint events publish on the bus and broadcast through the existing project rooms. |
| Backlog route and view | The existing backlog gains the sprint sections rather than being replaced. |
| taskIsCompleted expression | Provides the definition of unfinished work for the close workflow. |
| Typed Hono client, fetchers, and React Query hooks | Sprint fetchers and hooks follow the existing per-module structure. |
| Project layout and settings | The planning view reuses the project layout; the sprint settings reuse the project settings surface. |

## 5. Conclusions

Kaneo has a solid architectural foundation for sprints: a typed relational schema, an OpenAPI-first API, an event-driven realtime layer, and a mature backlog view. The gap is concentrated in the domain layer. The critical gaps G1, G2, G3, and G6 form the core deliverable; G4 and G5 enable the requested default behaviour; G7 delivers the implementation history; and the remaining gaps are integrations and hardening that follow the first release.
