# Sprint Planning for Kaneo — Unit Test Coverage

This document maps the sprint unit tests to the coverage required by the [testing strategy](./requirements-implementation-plan.md#12-testing-strategy). The lifecycle already had the integration test `tests/api-integration/sprint-lifecycle.test.ts` and the end-to-end test `tests/e2e/sprints.spec.ts`; the unit layer completes the strategy's matrix.

## Backend (`apps/api`)

The six sprint controllers are covered by colocated unit tests that mock the database, the event bus, and the `get-sprints` reader. They assert status codes and messages through `HTTPException` matches, so they pin the API contract, not the SQL.

| Test file | Covers |
|-----------|--------|
| `src/sprint/controllers/create-sprint.test.ts` | Next free `Sprint N` naming and list position, the 409 for duplicate names in a project, the 409 mapping when a concurrent create races the name check and trips `sprint_project_name_unique`, 400 for unparseable dates and inverted date ranges, the `sprint.updated` event, and the 500 when the insert returns no row. |
| `src/sprint/controllers/start-sprint.test.ts` | 404 for unknown sprints, 409 when the sprint is already active or closed, 409 when another sprint of the project is active, end-date derivation from the project's `defaultSprintLengthDays`, explicit date ranges, 400 for inverted ranges, and the 409 mapping when a concurrent start trips `sprint_project_active_unique`. |
| `src/sprint/controllers/close-sprint.test.ts` | 404 for unknown sprints, 409 for future and already closed sprints, 404 and 400 for invalid carry-over targets (other project, or not a future sprint), the transactional move of unfinished tasks to the target sprint or the backlog, the frozen `carryOverTasks` snapshot, and the `sprint.updated` event. |
| `src/sprint/controllers/update-sprint.test.ts` | 404 for unknown sprints, the immutability of closed sprints, 400 when the active sprint changes its start date, valid start-date moves and end-date clearing for future sprints, the 409 for renames that clash in the project, the clash check being skipped for unchanged names, and the 409 mapping when a concurrent rename trips `sprint_project_name_unique`. |
| `src/sprint/controllers/reorder-sprints.test.ts` | Writing every new position inside a single transaction, the 400 for sprints that are missing or not in the given project, and the `sprint.updated` event with the republished list. |
| `src/sprint/controllers/update-task-sprint.test.ts` | 404 for unknown tasks and cross-project targets, 409 for tasks locked in a closed sprint and for closed targets, backlog moves in both directions, and the `task.sprint_changed` plus `sprint.updated` events with the acting user. |

The pure helpers (`sprint-defaults.ts`, `sprint-scope.ts`) and the import planner (`plan-import-sprints.ts`, `write-import-sprints.ts`) were already covered; this change adds only the controller layer.

## Frontend (`apps/web`)

Sprint API access is covered by colocated tests next to the modules they exercise; all use the typed client mock, so the endpoint shapes stay pinned to `@kaneo/libs`.

| Test file | Covers |
|-----------|--------|
| `src/fetchers/sprint/*.test.ts` | Each of the seven fetchers (create, list, update, start, close with carry-over target, reorder, task assignment): the exact typed-client call for success, and `HttpError` propagation of the API status and message for failures. |
| `src/hooks/mutations/sprint/*.test.tsx` | Each of the six mutation hooks: the fetcher receives the right arguments, and the `sprints`, `tasks`, and `task` query entries are invalidated exactly as the hook defines (close also invalidates tasks; task assignment also invalidates the single task). |
| `src/hooks/queries/sprint/use-get-sprints.test.tsx` | Fetching the sprint list for a selected project and staying idle without one, so the backlog view does not fetch. |

## Running the tests

```bash
# Backend unit tests (includes the colocated sprint controller tests)
pnpm --filter @kaneo/api test:unit

# Web unit tests (colocated fetcher and hook tests run from the web app root)
pnpm --filter @kaneo/web test
```

Both suites run under the repository's vite-plus setup; the API tests run in the `node` environment, the web tests in `jsdom` with `@testing-library/react`.
