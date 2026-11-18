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

## Changelog

`CHANGELOG.md` is generated by semantic-release from conventional commits;
every change described here was pushed with conventional commit messages
(`fix:`, `feat(import):`, `chore(deps):`, `fix(i18n):`, `fix(db):`), so the
release notes pick them up when the sprint feature ships.
