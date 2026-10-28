import type { ProjectWithTasks } from "@/types/project";

export type BoardColumn = ProjectWithTasks["columns"][number];
export type BoardTask = BoardColumn["tasks"][number];

export function findBoardTask(
  board: Pick<ProjectWithTasks, "columns"> | undefined,
  taskId: string,
): BoardTask | undefined {
  for (const column of board?.columns ?? []) {
    const task = column.tasks.find((candidate) => candidate.id === taskId);
    if (task) return task;
  }
  return undefined;
}

/** The project a task belongs to; on a workspace board that is not the board. */
export function boardTaskProject(
  board: Pick<ProjectWithTasks, "columns" | "workspaceId"> | undefined,
  taskId: string,
) {
  const task = findBoardTask(board, taskId);
  return task && board
    ? {
        id: task.projectId,
        workspaceId: task.workspaceId ?? board.workspaceId,
      }
    : null;
}
