import { priorityColorsTaskCard } from "@/constants/priority-colors";
import useProjectStore from "@/store/project";
import useWorkspaceStore from "@/store/workspace";
import type Task from "@/types/task";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar, Flag, UserIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import TaskCardContextMenuContent from "./task-card-context-menu/task-card-context-menu-content";
import TaskCardLabels from "./task-labels";

interface TaskCardProps {
  task: Task;
}

function TaskCard({ task }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });
  const { project } = useProjectStore();
  const { workspace } = useWorkspaceStore();
  const navigate = useNavigate();

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    touchAction: "none",
  };

  function handleTaskCardClick() {
    if (!project || !task || !workspace) return;

    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: workspace.id,
        projectId: project.id,
        taskId: task.id,
      },
    });
  }

  console.log(task);

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleTaskCardClick}
            className="group bg-white dark:bg-zinc-800/50 backdrop-blur-sm rounded-lg border border-zinc-200 dark:border-zinc-700/50 p-3 cursor-move hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors shadow-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTaskCardClick();
            }}
          >
            <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-2">
              {project?.slug}-{task.number}
            </div>

            <div className="flex flex-col gap-2 mb-2">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 max-w-4/5 truncate">
                {task.title}
              </h3>
              <TaskCardLabels taskId={task.id} />
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-auto">
              {task.userEmail ? (
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100/50 dark:bg-zinc-800/50 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800/80 transition-colors"
                  title={task.userEmail}
                >
                  <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[100px]">
                    {task.userEmail}
                  </span>
                </div>
              ) : (
                <div
                  className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100/50 dark:bg-zinc-800/50 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800/80 transition-colors"
                  title="Unassigned"
                >
                  <UserIcon className="h-3 w-3 text-zinc-400 dark:text-zinc-500" />
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    Unassigned
                  </span>
                </div>
              )}

              {task.dueDate && (
                <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100/50 dark:bg-zinc-800/50 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800/80 transition-colors">
                  <Calendar className="w-3 h-3 text-zinc-400 dark:text-zinc-500" />
                  <span className="text-xs text-zinc-600 dark:text-zinc-400">
                    {format(new Date(task.dueDate), "MMM d, yyyy")}
                  </span>
                </div>
              )}

              <div className="flex-shrink-0">
                <span
                  className={`text-xs px-2 py-1 rounded-full ${priorityColorsTaskCard[task.priority as keyof typeof priorityColorsTaskCard]}`}
                >
                  <Flag className="w-3 h-3 inline-block mr-1" />
                  {task.priority}
                </span>
              </div>
            </div>
          </div>
        </ContextMenuTrigger>

        {project && workspace && (
          <TaskCardContextMenuContent
            task={task}
            taskCardContext={{
              projectId: project.id,
              worskpaceId: workspace.id,
            }}
          />
        )}
      </ContextMenu>
    </div>
  );
}

export default TaskCard;
