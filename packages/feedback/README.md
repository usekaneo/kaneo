# Feedback domain

**Status:** documentation-only placeholder. **Milestones:** [M1](https://github.com/PlaybookMediaLLC/kaneo/issues/7), [M2](https://github.com/PlaybookMediaLLC/kaneo/issues/8), [M5](https://github.com/PlaybookMediaLLC/kaneo/issues/11).

The Playbook-owned data model and service contracts for feedback, distinct from upstream Kaneo tasks.

## Planned responsibilities

- Product-scoped requests, comments, votes, customers, attachments and subscriptions.
- Duplicate/similar request grouping with original evidence preserved; never silently merge unrelated people or erase the original report.
- Triage, publishing decisions, status visibility, prioritization and request-to-task linkage.
- Many-to-many linkage: one request may require several tasks; one task may answer several requests.
- Changelog evidence, release mapping and notifications after authorized release confirmation.
- Customer/public authorization and internal workspace permission enforcement.

## Integration and ownership

Kaneo `apps/api` remains the API and permission foundation, and existing `task` / `project` records remain canonical for work. Keep feedback tables and services in Playbook-owned modules, with minimal registration/glue in upstream-owned code. Follow Kaneo's Drizzle migration, Hono route, Zod schema and event/test conventions where APIs connect.

This is a directory description, not a shipped package or migration.
