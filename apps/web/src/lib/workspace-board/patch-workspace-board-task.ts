import type { WorkspaceBoardQuery } from "@/fetchers/task/get-workspace-board";
import { boundBoardDescription } from "@/lib/bound-board-description";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { insertWorkspaceTask } from "./compare-workspace-tasks";
import { matchesWorkspaceBoardQuery } from "./matches-workspace-board-query";

type WorkspaceBoardLike = ProjectWithTasks & {
  projects?: Array<{
    id: string;
    name?: string;
    slug?: string;
    icon?: string | null;
    finalColumnSlugs?: string[];
  }>;
  /** Matching tasks on the server; follows tasks that join or leave. */
  total?: number;
};

type PatchOptions = {
  /** The server query the board was loaded with. */
  query?: WorkspaceBoardQuery;
};

function sameLabels(left: Task["labels"], right: Task["labels"]) {
  const key = (labels: Task["labels"]) =>
    (labels ?? [])
      .map((label) => `${label.name}\u0000${label.color}`)
      .sort()
      .join("\u0001");
  return key(left) === key(right);
}

function withoutTask<T extends WorkspaceBoardLike>(board: T, taskId: string) {
  return {
    ...board,
    columns: board.columns.map((column) => ({
      ...column,
      tasks: column.tasks.filter((task) => task.id !== taskId),
    })),
  };
}

function withTotal<T extends WorkspaceBoardLike>(board: T, delta: number): T {
  return delta !== 0 && typeof board.total === "number"
    ? { ...board, total: Math.max(0, board.total + delta) }
    : board;
}

/**
 * Apply one task's new state to a merged workspace board. Columns are keyed
 * by slug across projects, so the task's status alone decides its lane.
 * Returns the same board when nothing changes, and `null` to ask for a reload
 * when the new state needs a column the board does not have, or when the
 * board cannot tell whether the task belongs on it: a task missing from a
 * board that did not load every match, or a label filter.
 */
export function patchWorkspaceBoardTask<T extends WorkspaceBoardLike>(
  board: T,
  taskId: string,
  update?: Partial<Task>,
  options: PatchOptions = {},
): T | null {
  const existing = board.columns
    .flatMap((column) => column.tasks)
    .find((task) => task.id === taskId);
  const removed = () =>
    existing ? withTotal(withoutTask(board, taskId), -1) : board;
  const loaded = board.columns.reduce(
    (count, column) => count + column.tasks.length,
    0,
  );
  // A task the board does not show may still be counted in its total.
  const maybeCounted =
    !existing && typeof board.total === "number" && board.total > loaded;
  if (!update) return maybeCounted ? null : removed();

  // Partial fields cannot create a card; the task is simply not on this board.
  const complete = update.title !== undefined && update.status !== undefined;
  if (!existing && !complete) return board;
  if (maybeCounted) return null;
  if (
    update.projectId &&
    board.projects &&
    !board.projects.some((project) => project.id === update.projectId)
  ) {
    return removed();
  }

  const patch = boundBoardDescription(update) ?? update;
  // A single-task read has no project identity; a card joining the board
  // takes it from the board's project list.
  const project = board.projects?.find(
    (item) => item.id === (patch.projectId ?? existing?.projectId),
  );
  const task = {
    projectSlug: project?.slug,
    projectName: project?.name,
    projectIcon: project?.icon,
    workspaceId: board.workspaceId,
    ...existing,
    ...patch,
    assigneeId:
      "userId" in patch
        ? (patch.userId ?? null)
        : (existing?.assigneeId ?? null),
  } as Task;

  if (task.status === "archived" || task.status === "planned") return removed();
  const stripped = withoutTask(board, taskId);
  const column = stripped.columns.find((item) => item.slug === task.status);
  if (!column) return null;
  // Merged columns are final if any project says so; the server decides by the
  // task's own project, and so does this.
  const finalSlugs = project?.finalColumnSlugs;
  const isDone = finalSlugs ? finalSlugs.includes(task.status) : column.isFinal;
  const query = options.query ?? {};
  if (isDone && query.includeCompleted !== "true") return removed();
  const matches = matchesWorkspaceBoardQuery(task, query);
  if (matches === false) return removed();
  if (
    matches === undefined &&
    (!existing ||
      ("labels" in patch && !sameLabels(existing.labels, patch.labels)))
  ) {
    return null;
  }
  return withTotal(
    {
      ...stripped,
      columns: stripped.columns.map((item) =>
        item === column
          ? { ...item, tasks: insertWorkspaceTask(item.tasks, task) }
          : item,
      ),
    },
    existing ? 0 : 1,
  );
}
