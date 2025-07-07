import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";
import { format } from "date-fns";
import { Flag } from "lucide-react";

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
        {task.userEmail && (
          <Avatar className="h-6 w-6 ring-2 ring-zinc-100 dark:ring-zinc-700">
            <AvatarFallback className="text-xs font-medium">
              {task.userEmail.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}

        {task.dueDate && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 font-medium">
            {format(new Date(task.dueDate), "MMM d")}
          </div>
        )}

        {task.priority && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium",
              priorityColorsTaskCard[
                task.priority as keyof typeof priorityColorsTaskCard
              ],
            )}
          >
            <Flag className="w-3 h-3" />
            <span className="capitalize">{task.priority}</span>
          </div>
        )}
      </div>
    </button>
  );
}
