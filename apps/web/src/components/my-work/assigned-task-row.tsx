import { Link } from "@tanstack/react-router";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { getColumnIcon } from "@/lib/column";
import { getStatusDisplayLabel } from "@/lib/i18n/domain";
import { resolveLabelColor } from "@/lib/label-color";
import { getPriorityIcon } from "@/lib/priority";
import { DueDateText } from "./due-date-text";

type AssignedTaskRowProps = {
  task: AssignedTask;
  workspaceId: string;
  showLabels?: boolean;
};

export function AssignedTaskRow({
  task,
  workspaceId,
  showLabels = false,
}: AssignedTaskRowProps) {
  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
      className="flex h-11 items-center gap-3 border-border/50 border-b px-1 outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
    >
      <span className="flex w-4 shrink-0 justify-center [&_svg]:size-3.5">
        {getPriorityIcon(task.priority)}
      </span>
      <span
        className="shrink-0"
        title={getStatusDisplayLabel(task.status, task.statusName ?? undefined)}
      >
        {getColumnIcon(task.status, false, task.statusIcon)}
      </span>
      <span className="w-16 shrink-0 truncate font-medium text-muted-foreground text-xs">
        {task.number == null
          ? task.projectSlug
          : `${task.projectSlug}-${task.number}`}
      </span>
      <span className="min-w-0 flex-1 truncate text-foreground text-sm">
        {task.title}
      </span>
      {showLabels && task.labels.length > 0 && (
        <span className="hidden w-44 shrink-0 items-center gap-2.5 overflow-hidden lg:flex">
          {task.labels.slice(0, 2).map((label) => (
            <span
              key={label.id}
              className="flex min-w-0 items-center gap-1.5 text-muted-foreground text-xs"
            >
              <span
                aria-hidden="true"
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: resolveLabelColor(label.color) }}
              />
              <span className="truncate">{label.name}</span>
            </span>
          ))}
        </span>
      )}
      <span className="hidden w-28 shrink-0 truncate text-muted-foreground text-xs sm:block">
        {task.projectName}
      </span>
      <DueDateText
        dueDate={task.dueDate}
        className="w-20 shrink-0 text-right"
      />
    </Link>
  );
}
