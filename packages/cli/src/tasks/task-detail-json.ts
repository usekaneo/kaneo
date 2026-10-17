import type { ResolvedTask } from "./resolve-task.js";

export type TaskDetailJson = {
  readonly id: string;
  readonly ticketId: string | null;
  readonly number: number | null;
  readonly title: string;
  readonly description: string | null;
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
  readonly projectKey: string;
  readonly projectName: string;
  readonly workspaceId: string;
  readonly url: string;
};

export function toTaskDetailJson(resolved: ResolvedTask): TaskDetailJson {
  const { task, project } = resolved;
  const column = resolved.columns.find(
    (candidate) => candidate.slug === task.status,
  );
  return {
    id: task.id,
    ticketId: resolved.ticketId,
    number: task.number,
    title: task.title,
    description: task.description,
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
    projectKey: project.slug.toUpperCase(),
    projectName: project.name,
    workspaceId: resolved.workspaceId,
    url: resolved.url,
  };
}
