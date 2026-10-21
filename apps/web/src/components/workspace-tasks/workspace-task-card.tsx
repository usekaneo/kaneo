import { Link } from "@tanstack/react-router";
import { DueDateText } from "@/components/my-work/due-date-text";
import { AssigneeAvatars } from "@/components/task/assignee-avatars";
import type { WorkspaceTask } from "@/fetchers/task/get-workspace-tasks";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";

export function WorkspaceTaskCard({
  task,
  workspaceId,
}: {
  task: WorkspaceTask;
  workspaceId: string;
}) {
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
      className="block space-y-3 rounded-md border bg-background p-3 outline-none transition-colors hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center gap-2 text-muted-foreground text-xs">
        {getPriorityIcon(task.priority)}
        <span className="truncate">
          {task.projectSlug}
          {task.number == null ? "" : `-${task.number}`} · {task.projectName}
        </span>
      </div>
      <p className="break-words font-medium text-sm">{task.title}</p>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="flex min-w-0 flex-1 items-center gap-1.5">
          {getColumnIcon(task.status, false, task.statusIcon)}
          <span className="truncate">
            {getStatusDisplayLabel(task.status, task.statusName ?? undefined)}
          </span>
        </span>
        <DueDateText dueDate={task.dueDate} />
        <span className="sr-only">
          {task.assignees.map((person) => person.name).join(", ")}
        </span>
        <AssigneeAvatars
          task={{ userId: null, assignees: task.assignees }}
          className="size-5"
        />
      </div>
    </Link>
  );
}
