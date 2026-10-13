import { getColumnIcon } from "@/lib/column";
import { getPriorityIcon } from "@/lib/priority";
import type { AssignedTask } from "./assigned-tasks";
import { DueDateText } from "./due-date-text";
import { resolveLabelColor } from "./label-color";

// Same row as apps/web's my-work/assigned-task-row.
export function AssignedTaskRow({
  task,
  showLabels = false,
  onTaskClick,
}: {
  task: AssignedTask;
  showLabels?: boolean;
  onTaskClick: (task: AssignedTask) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onTaskClick(task)}
      className="flex h-11 w-full items-center gap-3 border-b border-border/50 px-1 text-left outline-none transition-colors hover:bg-accent/50 focus-visible:bg-accent/50"
    >
      <span className="flex w-4 shrink-0 justify-center [&_svg]:size-3.5">
        {getPriorityIcon(task.priority ?? "")}
      </span>
      <span className="shrink-0" title={task.statusName}>
        {getColumnIcon(task.status)}
      </span>
      <span className="w-16 shrink-0 truncate text-xs font-medium text-muted-foreground">
        {task.projectSlug}-{task.number}
      </span>
      <span className="min-w-0 flex-1 truncate text-sm text-foreground">
        {task.title}
      </span>
      {showLabels && !!task.labels?.length && (
        <span className="flex w-44 shrink-0 items-center gap-2.5 overflow-hidden">
          {task.labels.slice(0, 2).map((label) => (
            <span
              key={label.id}
              className="flex min-w-0 items-center gap-1.5 text-xs text-muted-foreground"
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
      <span className="w-28 shrink-0 truncate text-xs text-muted-foreground">
        {task.projectName}
      </span>
      <DueDateText
        dueDate={task.dueDate}
        className="w-20 shrink-0 text-right"
      />
    </button>
  );
}
