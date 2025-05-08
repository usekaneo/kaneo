import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { cn } from "@/lib/cn";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Flag, GripVertical } from "lucide-react";
import TaskCardContextMenuContent from "../kanban-board/task-card-context-menu/task-card-context-menu-content";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";

interface TaskRowProps {
  task: Task;
  projectSlug: string;
}

function TaskRow({ task, projectSlug }: TaskRowProps) {
  const navigate = useNavigate();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const { project } = useProjectStore();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    touchAction: "none",
  };

  const handleClick = () => {
    if (!project || !task) return;

    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        taskId: task.id,
      },
    });
  };

  return (
    <div ref={setNodeRef} style={style}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={(e) => {
              if (e.nativeEvent.which === 1) {
                handleClick();
              }
            }}
            onKeyDown={(e) => e.key === "Enter" && handleClick()}
            className={cn(
              "group px-4 py-2 rounded-lg flex items-center gap-4 bg-white dark:bg-zinc-900",
              "hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors cursor-pointer",
              "border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800",
              isDragging && "opacity-25",
            )}
          >
            <button
              type="button"
              className="p-1 -ml-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-grab active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="w-4 h-4 text-zinc-400" />
            </button>

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
                  <span className="capitalize hidden group-hover:inline">
                    {task.priority}
                  </span>
                </div>
              )}
            </div>
          </div>
        </ContextMenuTrigger>

        {project && (
          <TaskCardContextMenuContent
            task={task}
            taskCardContext={{
              projectId: project.id,
              worskpaceId: project.workspaceId,
            }}
          />
        )}
      </ContextMenu>
    </div>
  );
}

export default TaskRow;
