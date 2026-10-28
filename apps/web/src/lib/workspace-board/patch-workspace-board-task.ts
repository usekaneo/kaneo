import { boundBoardDescription } from "@/lib/bound-board-description";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import { insertWorkspaceTask } from "./compare-workspace-tasks";

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
  /** Whether the board shows tasks sitting in final columns. */
  includeCompleted?: boolean;
};

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
 * Returns the same board when nothing changes, and `null` when the new state
 * needs a column the board does not have, which asks for a reload.
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
  if (!update) return removed();

  // Partial fields cannot create a card; the task is simply not on this board.
  const complete = update.title !== undefined && update.status !== undefined;
  if (!existing && !complete) return board;
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
  if (isDone && !options.includeCompleted) return removed();
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
