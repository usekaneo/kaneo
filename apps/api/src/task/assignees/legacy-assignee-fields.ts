import type { TaskAssignee } from "./get-task-assignees";
export function legacyAssigneeFields(people: TaskAssignee[]) {
  const first = people[0];
  return {
    userId: first?.id ?? null,
    assigneeId: first?.id ?? null,
    assigneeName: first?.name ?? null,
    assigneeImage: first?.image ?? null,
  };
}
