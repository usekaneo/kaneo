import { toSlug } from "../../column/to-slug";

export const GLOBAL_STATUSES = ["to-do", "in-progress", "done"] as const;
export type GlobalStatus = (typeof GLOBAL_STATUSES)[number];

type ColumnShape = {
  slug: string;
  name: string;
  isFinal: boolean;
  position: number;
};

const TO_DO_NAMES = new Set([
  "to-do",
  "todo",
  "backlog",
  "open",
  "new",
  "triage",
  "inbox",
  "icebox",
  "not-started",
]);
const IN_PROGRESS_NAMES = new Set([
  "in-progress",
  "doing",
  "wip",
  "in-review",
  "review",
  "code-review",
  "testing",
  "qa",
  "blocked",
  "on-hold",
  "started",
]);
const DONE_NAMES = new Set([
  "done",
  "completed",
  "complete",
  "closed",
  "finished",
  "resolved",
  "shipped",
]);

// Renamed columns keep their original slug, so the current name decides first.
function nameHint(column: ColumnShape) {
  for (const key of [toSlug(column.name), column.slug]) {
    if (TO_DO_NAMES.has(key)) return "to-do";
    if (IN_PROGRESS_NAMES.has(key)) return "in-progress";
    if (DONE_NAMES.has(key)) return "done";
  }
  return null;
}

/**
 * Maps each column slug of one project to a board-wide status, or `null` when
 * the column cannot be placed without guessing.
 *
 * - Final columns are done: `isFinal` already defines completion everywhere.
 * - A non-final column named like a finished state is contradictory → null.
 * - Recognised names (To Do, Backlog, Doing, In Review, …) map directly.
 * - Other columns take their place in the workflow: those before the first
 *   in-progress column (or, without one, through the last to-do column, or
 *   else just the first column) are to-do; later ones are in progress.
 * - A slug shared by columns that map differently is ambiguous → null.
 */
export function classifyProjectColumns(columns: readonly ColumnShape[]) {
  const open = columns
    .filter((column) => !column.isFinal)
    .sort((a, b) => a.position - b.position);
  const hints = open.map(nameHint);
  const firstInProgress = hints.indexOf("in-progress");
  const lastToDo = hints.lastIndexOf("to-do");
  const workStarts =
    firstInProgress >= 0 ? firstInProgress : lastToDo >= 0 ? lastToDo + 1 : 1;

  const byColumn = new Map<ColumnShape, GlobalStatus | null>();
  open.forEach((column, index) => {
    const hint = hints[index];
    if (hint === "done") byColumn.set(column, null);
    else if (hint) byColumn.set(column, hint);
    else byColumn.set(column, index < workStarts ? "to-do" : "in-progress");
  });

  const bySlug = new Map<string, GlobalStatus | null>();
  for (const column of columns) {
    const status = column.isFinal ? "done" : (byColumn.get(column) ?? null);
    bySlug.set(
      column.slug,
      bySlug.has(column.slug) && bySlug.get(column.slug) !== status
        ? null
        : status,
    );
  }
  return bySlug;
}
