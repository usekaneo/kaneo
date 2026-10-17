import type { BoardTask } from "../api/schemas.js";
import { taskUrl } from "../render/links.js";
import { ticketId } from "../render/task-format.js";
import type { LoadedBoard } from "./load-board.js";

export type TaskJson = {
  readonly id: string;
  readonly ticketId: string | null;
  readonly number: number | null;
  readonly title: string;
  readonly status: string;
  readonly statusName: string;
  readonly priority: string;
  readonly assignee: {
    readonly id: string;
    readonly name: string | null;
  } | null;
  readonly dueDate: string | null;
  readonly startDate: string | null;
  readonly createdAt: string;
  readonly projectId: string;
  readonly workspaceId: string;
  readonly url: string;
};

export function toTaskJson(
  board: LoadedBoard,
  task: BoardTask,
  webUrl: string,
): TaskJson {
  const column = board.columns.find(
    (candidate) => candidate.slug === task.status,
  );
  return {
    id: task.id,
    ticketId: ticketId(board.projectSlug, task.number),
    number: task.number,
    title: task.title,
    status: task.status,
    statusName: column?.name ?? task.status,
    priority: task.priority,
    assignee: task.assigneeId
      ? { id: task.assigneeId, name: task.assigneeName }
      : null,
    dueDate: task.dueDate,
    startDate: task.startDate,
    createdAt: task.createdAt,
    projectId: task.projectId,
    workspaceId: board.workspaceId,
    url: taskUrl(webUrl, {
      workspaceId: board.workspaceId,
      projectId: task.projectId,
      id: task.id,
    }),
  };
}
