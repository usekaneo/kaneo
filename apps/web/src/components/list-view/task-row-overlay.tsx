import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { cn } from "@/lib/cn";
import type { Task } from "@/types/project";
import { format } from "date-fns";
import { Flag } from "lucide-react";

interface TaskRowOverlayProps {
  task: Task;
  projectSlug: string;
}

function TaskRowOverlay({ task, projectSlug }: TaskRowOverlayProps) {
  return (
    <div
      className={cn(
        "px-4 py-2 rounded-lg flex items-center gap-4 w-[95%]",
        "bg-white dark:bg-zinc-900 shadow-xl border border-zinc-200 dark:border-zinc-700",
        "transform rotate-2 cursor-grabbing",
        "ring-1 ring-black/5 dark:ring-white/5",
        "w-[calc(100%-2rem)]",
        "max-w-3xl",
      )}
    >
      <div className="flex-1 min-w-0 flex items-center gap-3">
        <div className="text-xs font-mono text-zinc-500 dark:text-zinc-400 shrink-0">
          {projectSlug}-{task.number}
        </div>

        <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {task.title}
        </h3>
      </div>

      <div className="flex items-center gap-3">
        {task.userEmail ? (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {task.userEmail.charAt(0)}
            </AvatarFallback>
          </Avatar>
        ) : (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">
              ?
            </AvatarFallback>
          </Avatar>
        )}

        {task.dueDate && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {format(new Date(task.dueDate), "MMM d")}
          </div>
        )}

        {task.priority && (
          <div
            className={cn(
              "flex items-center gap-1 text-xs px-2 py-1 rounded-full",
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
    </div>
  );
}

export default TaskRowOverlay;
