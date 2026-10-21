import type Task from "@/types/task";
export function getTaskAssigneeIds(
  task: Pick<Task, "userId" | "assignees">,
): string[] {
  return (
    task.assignees?.map((person) => person.id) ??
    (task.userId ? [task.userId] : [])
  );
}
