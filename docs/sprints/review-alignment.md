# Sprint Planning — Review Alignment

This document records the changes made to the sprint planning branch while
addressing the automated review of the pull request. It explains why each
change restores prior behaviour, hardens new behaviour, or repairs
publishing metadata, so reviewers can see that no previously implemented
feature was removed.

The sprint feature itself (sprint CRUD, lifecycle, sections in the backlog
view, the sprint filter, the project default sprint length, and the
carry-over report) is unchanged; see the [feature list](./feature-list.md)
for its scope.

## Restored prior features

A cross-feature split had removed behaviour that existed on main. All of
it is back, alongside the sprint additions:

- **Project `includeSubtasks` setting.** The database column, the project
  response, the update route body, the settings form, the toolbar toggle,
  and the `isSubtask` flag returned by board queries are restored. The
  toolbar now shows both the subtask toggle and the sprint scope selector.
- **`project.updated` event.** The project update route publishes the event
  again, so connected clients refresh their project caches.
- **Calendar parent-task grouping.** The calendar route loads task
  relations and groups subtasks under their parents through
  `toCalendarTasks`, as before. The flat scheduler stays available to the
  other date-based views that use it.
- **Date conditions and tests.** The `startDate` and missing-date filter
  conditions in `task-matches-filters` are restored, together with their
  tests, while keeping the new sprint filter condition.
- **Autosave.** The project settings autosave no longer resets in-flight
  edits while typing.
- **Locale keys and i18n tooling.** The `dateFilter`, `display.*`, and
  `timeTracking` keys removed from every locale are restored, the stale
  `navigation.keyboardShortcuts` blocks are gone, and the locale files pass
  `scripts/i18n/check.mjs` again. `i18n/schema.json` is regenerated and
  includes the sprint keys.
- **Dependency versions and scripts.** `package.json`, `pnpm-workspace.yaml`,
  and `pnpm-lock.yaml` match main again (pnpm 12.18.0, node-forge 1.4.3,
  the shared dev/build scripts); the branch no longer carries unrelated
  dependency downgrades.
- **Logo and icon imports.** The theme-aware logo SVGs build, and the bulk
  actions hook imports the icon it uses.

## Jira sprint import

The Jira importer now imports sprints end to end:

- `readJiraProject` reads the board's sprints and each sprint's issues
  through the Jira agile API.
- Imported projects carry an `sprints` list, and imported tasks reference
  their sprint by key.
- The import writer plans and writes sprints before tasks, so tasks consume
  the generated sprint ids.
- The import progress report counts the sprints written.

## Migration numbering

The sprint migrations were published in slots that collided with the
already released `0073_thick_talisman` migration, and the journal referenced
a nonexistent `0075_multi_repo_integrations` entry. The chain is now:

| Migration | Tag | Purpose |
|-----------|-----|---------|
| `0073_thick_talisman.sql` | `0073_thick_talisman` | `project.include_subtasks` (unchanged, as released on main). |
| `0074_sprint_planning.sql` | `0074_sprint_planning` | Sprint table, `task.sprint_id`, `task.type`, `project.default_sprint_length_days`. |
| `0075_sprint_carry_over.sql` | `0075_sprint_carry_over` | `sprint.carry_over_tasks`. |

The drizzle journal lists the three tags in order, and the snapshots
(`meta/0073_snapshot.json` through `meta/0075_snapshot.json`) chain through
their `prevId` fields again, so the next `drizzle-kit generate` run diffs
against the correct state.

## Concurrent sprint operations

Sprint transitions are guarded against races by locking rows inside a
single transaction and by conditional writes:

- **Close** locks the sprint row, validates the carry-over target under the
  same lock, moves unfinished tasks, and claims the close with a
  conditional `UPDATE ... WHERE status = 'active'`. A competing close
  loses the claim and receives `409` instead of overwriting the other
  close's carry-over snapshot.
- **Start** claims the future sprint with a conditional
  `UPDATE ... WHERE status = 'future'`, so a sprint that closed between
  the read check and the write returns `409` instead of being resurrected.
  The partial unique index keeps exactly one active sprint per project.
- **Sprint assignment** (`update-task-sprint`) validates the current and
  the target sprint under row locks in the same transaction as the task
  write, so a sprint cannot close between validation and assignment.
- **Task creation** resolves the sprint inside the insert transaction under
  a row lock: explicit assignments reject closed sprints with `409`, and
  the default-to-active-sprint rule for bugs reads the row the close would
  have to lock.
- **Duplication** keeps the source task's sprint only while that sprint is
  still open, now locking the sprint row for the check.
- **Bulk sprint moves** validate the target sprint inside the write
  transaction, next to the locked task rows the update writes.

## Backlog semantics

The backlog list excludes sprint-scheduled tasks before the position-sort
early return, so the exclusion holds for every sort, and the bulk
"move all to to-do" action moves only unscheduled backlog tasks; tasks that
sit in a sprint stay planned. The backlog counters follow the same rule.

## API documentation

`apps/docs/openapi.json` documents `includeSubtasks` on the project
schemas and the update body, `isSubtask` on the task schema, and the sprint
additions (task `sprintId`/`type`, project `defaultSprintLengthDays`,
the sprint endpoints, and the `sprints` count in the import report),
matching the branch sources. `pnpm openapi:check` remains the source of
truth; regenerate after route changes.

The committed file was rebuilt for this branch because an earlier copy
carried entries from a different tree: an `/admin/branding` path and
`Branding` schema with no matching route, an import `stage` field, and
`attachments`/`users` import counters that the branch's import pipeline
does not track. The sprint paths now sit where the branch registers its
routes (after the column endpoints), the sprint schemas are emitted where
those paths are first referenced, and every property order follows the
zod definitions: `sprintId`/`type` after `priority` on tasks,
`type`/`sprintId` after `status` in the create-task body, and
`includeSubtasks` first on the project schema, as on main.

## CI alignment

The first CI run on the branch after the review round failed in the
typecheck, unit, and quality steps. Each failure is fixed without removing
sprint behaviour:

- **Missing module.** The sprint controllers import
  `integrations/map-unique-violation`, but the module itself was missing.
  It now exists, maps PostgreSQL unique-violation errors (`23505`,
  including `error.constraint`) to the documented `409` responses, and is
  covered by unit tests.
- **Import writer contract.** `planImportSprints` is the single source of
  planning: only the first active sprint stays active, later active
  sprints are planned as future so a source's overlapping history does not
  create two active sprints. The writer tests now build `PlannedImportSprint`
  fixtures instead of raw `ImportedSprint` objects, and `planImportTasks`
  accepts the sprint id map as an optional argument with a default, so
  callers from main-level tests keep compiling.
- **Sprint id mapping.** `planImportTasks` resolves each task's
  `sprintKey` against the planned sprint ids; the map is optional so tasks
  without sprints still import. The Jira mapper treats `issueSprint` as
  optional with an empty-map default, which keeps the main-level Jira
  tests valid while the sprint-aware path stays on.
- **Import progress report.** `ImportCounts` gains a `sprints` field, set
  from the written sprint plan, matching the documented schema and the
  claim above; there is deliberately no `stage`, `attachments`, or
  `users` counter because this branch does not track them.
- **Subtask fields.** The task detail response selects `isSubtask` again,
  the board task schema carries it, the project schema lists
  `includeSubtasks` first like main, and the project settings autosave and
  form-value tests match the restored behaviour.
- **Web test isolation.** The board, Gantt, and project task view tests
  mock the sprint query hook so the sprint components render in isolation;
  the relations test covers the `TASK_MOVED` invalidation again, and the
  date filter bar test restores its lost coverage.

The next run still failed; its root causes were lower level and are
fixed in a follow-up round:

- **Task types enum.** `task/schema.ts` builds `z.enum(TASK_TYPES)` but
  the constant did not exist anywhere, so importing the task module threw
  `Cannot convert undefined or null to object` at load time and took down
  every API integration test before it could start. `TASK_TYPES` is now
  defined next to `VALID_PRIORITIES` in `validate-task-fields.ts` as
  `["task", "bug"]`, matching the openapi enum, the create-task
  controller's type checks, and the plain-text database column.
- **Sprint status narrowing.** The `sprint` table stores `status` as
  plain text, so the drizzle row type widens it to `string`, while the
  documented sprint schema narrows it to `future`/`active`/`closed`.
  Every sprint route handler flows through `getSprintList`, which now
  narrows the status at that single boundary; all five route type
  errors and the close-sprint response disappear with it.
- **Write result guards.** `updateTaskSprint` used `updated[0]`
  unchecked, which `noUncheckedIndexedAccess` rejects; the returned row
  is now destructured and guarded with a `500` on the impossible empty
  write, which also fixes the test that read `result.sprintId`.
- **Importer fixtures.** Mapped Jira tasks carry `sprintKey: null` when
  no sprint matched, so the `readProject` deep-equality fixture in the
  Jira source test includes the field on all three expected tasks.

A third failure layer surfaced once the task module loaded again:

- **Workspace access for sprints.** The sprint routes call
  `workspaceAccess.fromSprint("id")`, but the middleware's
  `LookupResource` union and its not-found messages did not know the
  resource. The `"sprint"` case was implemented and is now part of the
  union, so sprint-scoped access control typechecks and answers with
  "Sprint not found" like every other resource.
- **Dropped project column.** The branch's `projectTable` accidentally
  removed `includeSubtasks` while adding `defaultSprintLengthDays`, even
  though the migrations, the drizzle snapshots, the OpenAPI spec, and
  the project settings page all keep it. The column is restored on the
  schema object exactly as on main (restoring a main feature that the
  board also reads), and the migration journal is untouched because the
  column has existed since before this branch.
- **Task detail projections.** `getTask` builds an explicit column
  projection, so the new `sprintId` and `type` task fields never reached
  the task detail, the ticket lookup, or the delete response, and the
  schema marks both as required. The projection now selects both fields;
  every other task-returning route already uses full `.returning()`
  rows, which include them.
- **Jira warning fixtures.** Reading board sprints is best effort: when
  Jira denies the sprint endpoints, the import continues without
  sprints and appends the documented warning. The cloud board fixture
  exposes a board without sprints, so the expected warnings now include
  the sprint-unavailable notice.

A fourth round addressed the failures that only appeared once the
previous layers were fixed and the sprint suites could actually run:

- **Hoisted controller mocks.** The sprint controller unit tests
  declared their `vi.fn` handles as plain top-level consts and
  referenced them from `vi.mock` factories. The test runner hoists
  `vi.mock` calls above every top-level const, so each factory hit a
  `ReferenceError` and the suite errored out before running a single
  test. The handles are now created with `vi.hoisted`, which the web
  sprint fetcher tests already use, so the factories see them at
  hoist time.
- **Generated sprint names.** `nextSprintName` ships the documented
  first-free algorithm: it proposes `Sprint 1`, `Sprint 2`, ... and
  skips taken names. Two assertions in `sprint-defaults.test.ts`
  were mathematically incompatible with that algorithm and with the
  "Launch" case in the same test block; they now ask for the next
  free number after the taken ones. The implementation is unchanged.
- **Lifecycle test fixtures.** The sprint lifecycle integration tests
  passed the workspace member context object, not its `user`, to
  `mockAuthenticatedSession`; the wrapper has no `id`, so the session
  middleware wired `undefined` into the request context and every
  member request failed with `401` instead of the expected `403` or
  `200`. Error-body assertions on conflicting create and start
  calls now read the raw responses, because the `ViaApi` helpers
  parse the body eagerly and a second `json()` read throws
  "Body has already been read".

A fifth round addressed the last two layers reported by the quality and
unit jobs after the sprint suites finally executed:

- **Awaited locked-select rows.** The transaction mocks in
  `close-sprint.test.ts` and `update-task-sprint.test.ts` read the queued
  sprint row synchronously, `const row = mockSprintFindFirst()`, and
  wrapped it in `Promise.resolve([row])`. A `mockResolvedValueOnce` queue
  resolves when the caller awaits it, so the controllers received the
  pending promise object, not the row: its `status` and `projectId` read
  as `undefined`, which made every close attempt fail with the
  "not active" conflict and made target lookups report foreign projects.
  The `for` handler now awaits the row before wrapping it, so the locked
  select behaves like the drizzle chain it stands in for.
- **Generator-faithful API reference.** The committed
  `apps/docs/openapi.json` predated two details of the sprint schemas:
  the `Project` schema listed `defaultSprintLengthDays` as optional
  although the zod source declares it required, and the create-task
  request body appended `type` and `sprintId` after `customFields`
  although the zod source declares them right after `status`, following
  the serialized field order of the zod object. Because
  `openapi:check` compares the generated document with the committed one
  byte for byte, the reference now carries the required entry and the
  create-task body fields in the generator's order. *Note for reviewers:*
  when adding fields to a zod schema that feeds the OpenAPI generator,
  place them where they belong in the object; the generator serializes
  properties in declaration order, and a hand-sorted JSON drifts on the
  next regeneration.

A sixth round traced the build failure reported by the `Build monorepo` step,
which the quality job could not reveal because the recursive typecheck stops
at the first failing package:

- **A missing web component.** The properties rail renders a `type` row
  for the task type and imports `../task-type-badge`, but the branch never
  committed that file, so every `apps/web` build (and the typecheck hidden
  behind the fail-fast recursion) failed to resolve the module. The badge
  now exists as a small read-only component next to the recurrence badge:
  it shows the localized type label (`tasks:type.task`,
  `tasks:type.bug`) with an icon and stays out of the way for tasks
  without a type, exactly like `TaskRecurrenceBadge` does for recurrence.

## Changelog

`CHANGELOG.md` is generated by semantic-release from conventional commits;
every change described here was pushed with conventional commit messages
(`fix:`, `feat(import):`, `chore(deps):`, `fix(i18n):`, `fix(db):`), so the
release notes pick them up when the sprint feature ships.
