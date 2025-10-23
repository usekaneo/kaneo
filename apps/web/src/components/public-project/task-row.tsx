import { format } from "date-fns";
import { Calendar, CalendarClock, CalendarX } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { getPriorityIcon } from "@/lib/priority";
import type Task from "@/types/task";

interface PublicTaskRowProps {
  task: Task;
  projectSlug: string;
  onTaskClick: (task: Task) => void;
}

export function PublicTaskRow({
  task,
  projectSlug,
  onTaskClick,
}: PublicTaskRowProps) {
  return (
    <button
      type="button"
      className="group w-full text-left px-4 py-3 rounded-lg flex items-center gap-4 bg-white dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700/50 shadow-sm hover:shadow-md transition-all hover:border-zinc-300 dark:hover:border-zinc-600 hover:scale-[1.01] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
      onClick={() => onTaskClick(task)}
      aria-label={`View details for task ${task.title}`}
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 shrink-0 font-medium">
          {projectSlug}-{task.number}
        </div>
        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {task.title}
        </h3>
      </div>

      <div className="flex items-center gap-3">
        {task.userId && (
          <Avatar className="h-6 w-6 ring-2 ring-zinc-100 dark:ring-zinc-700">
            <AvatarFallback className="text-xs font-medium">
              {task.userId.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}

        {task.dueDate && (
          <div
            className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
          >
            {getDueDateStatus(task.dueDate) === "overdue" && (
              <CalendarX className="w-3 h-3" />
            )}
            {getDueDateStatus(task.dueDate) === "due-soon" && (
              <CalendarClock className="w-3 h-3" />
            )}
            {(getDueDateStatus(task.dueDate) === "far-future" ||
              getDueDateStatus(task.dueDate) === "no-due-date") && (
              <Calendar className="w-3 h-3" />
            )}
            <span>{format(new Date(task.dueDate), "MMM d")}</span>
          </div>
        )}

        {task.priority && (
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-sidebar text-[10px] font-medium text-muted-foreground">
            {getPriorityIcon(task.priority)}
          </div>
        )}
      </div>
    </button>
  );
}
