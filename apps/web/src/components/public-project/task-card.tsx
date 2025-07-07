import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { cn } from "@/lib/cn";
import type Task from "@/types/task";
import { format } from "date-fns";
import { Flag } from "lucide-react";

interface PublicTaskCardProps {
  task: Task;
  projectSlug: string;
  onTaskClick: (task: Task) => void;
}

export function PublicTaskCard({
  task,
  projectSlug,
  onTaskClick,
}: PublicTaskCardProps) {
  return (
    <button
      type="button"
      className="w-full text-left p-4 bg-white dark:bg-zinc-800/80 rounded-lg border border-zinc-200 dark:border-zinc-700/50 shadow-sm hover:shadow-md transition-all cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-600 hover:scale-[1.02] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-zinc-900"
      onClick={() => onTaskClick(task)}
      aria-label={`View details for task ${task.title}`}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400">
              {projectSlug}-{task.number}
            </div>
            <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-relaxed">
              {task.title}
            </h3>
          </div>
        </div>

        {task.description && (
          <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-3 leading-relaxed">
            {task.description}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
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

          <div className="flex items-center gap-2">
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
          </div>
        </div>
      </div>
    </button>
  );
}
