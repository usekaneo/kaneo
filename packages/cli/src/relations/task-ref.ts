import type { ResolvedTask } from "../tasks/resolve-task.js";

export type TaskRef = {
  readonly id: string;
  readonly ticketId: string | null;
  readonly title: string;
  readonly url: string;
};

export function taskRef(resolved: ResolvedTask): TaskRef {
  return {
    id: resolved.task.id,
    ticketId: resolved.ticketId,
    title: resolved.task.title,
    url: resolved.url,
  };
}

export function taskLabel(task: TaskRef): string {
  return task.ticketId ?? task.id.slice(0, 8);
}
