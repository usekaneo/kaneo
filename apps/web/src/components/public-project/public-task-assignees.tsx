import { AssigneeAvatars } from "@/components/task/assignee-avatars";
import type Task from "@/types/task";
export function PublicTaskAssignees({
  task,
}: {
  task: Pick<Task, "userId" | "assignees" | "assigneeName" | "assigneeImage">;
}) {
  const names =
    task.assignees?.map((person) => person.name).join(", ") ||
    task.assigneeName;
  if (!names) return null;
  return (
    <div className="flex items-center gap-1.5">
      <AssigneeAvatars
        task={task}
        name={task.assigneeName}
        image={task.assigneeImage}
      />
      <span className="truncate text-xs font-medium text-muted-foreground">
        {names}
      </span>
    </div>
  );
}
