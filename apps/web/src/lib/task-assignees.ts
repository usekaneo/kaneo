import type Task from "@/types/task";

export const MAX_ASSIGNEES = 20;

type AssigneeSource = Pick<Task, "userId"> &
  Partial<Pick<Task, "assigneeIds" | "assignees">>;

// Older responses only carry the primary assignee.
export function getTaskAssigneeIds(task: AssigneeSource): string[] {
  if (task.assigneeIds && task.assigneeIds.length > 0) return task.assigneeIds;
  return task.userId ? [task.userId] : [];
}

// "" stands for the unassigned option in the assignee filter.
export function getAssigneeFilterKeys(task: AssigneeSource): string[] {
  const ids = getTaskAssigneeIds(task);
  return ids.length > 0 ? ids : [""];
}

export function toggleAssignee(ids: readonly string[], id: string): string[] {
  if (id === "") return [];
  if (ids.includes(id)) return ids.filter((existing) => existing !== id);
  return ids.length >= MAX_ASSIGNEES ? [...ids] : [...ids, id];
}

export function sameAssigneeSet(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length && left.every((id) => right.includes(id));
}

// Compact avatar stacks show a few people and fold the rest into "+N".
export function splitVisibleAssignees<T>(assignees: readonly T[], max = 3) {
  if (assignees.length <= max) {
    return { shown: [...assignees], overflow: 0 };
  }
  // The +N chip takes the last slot, so it never hides just one person.
  return {
    shown: assignees.slice(0, max - 1),
    overflow: assignees.length - (max - 1),
  };
}
