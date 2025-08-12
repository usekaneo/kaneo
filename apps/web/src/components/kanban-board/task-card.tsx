import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import useWorkspaceStore from "@/store/workspace";
import type Task from "@/types/task";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import {
  Calendar,
  CalendarClock,
  CalendarX,
  Flag,
  UserIcon,
} from "lucide-react";
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
  const {
    showAssignees,
    showPriority,
    showDueDates,
    showLabels,
    showTaskNumbers,
  } = useUserPreferencesStore();

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition || "transform 250ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    opacity: isDragging ? 0.6 : 1,
    touchAction: "none",
    zIndex: isDragging ? 999 : "auto",
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

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleTaskCardClick}
            className={`group bg-white dark:bg-zinc-800/50 backdrop-blur-sm rounded-lg border p-2.5 cursor-move shadow-sm transition-all duration-200 ease-out ${
              isDragging
                ? "border-indigo-300 dark:border-indigo-600/70 shadow-lg shadow-indigo-500/10 dark:shadow-indigo-400/5 bg-white dark:bg-zinc-800/80"
                : "border-zinc-200 dark:border-zinc-700/50 hover:border-zinc-300 dark:hover:border-zinc-600 hover:shadow-md"
            }`}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTaskCardClick();
            }}
          >
            {showTaskNumbers && (
              <div className="flex items-center gap-2 text-xs font-mono text-zinc-500 dark:text-zinc-400 mb-1.5">
                {project?.slug}-{task.number}
              </div>
            )}

            <div className="flex flex-col gap-1.5 mb-1.5">
              <h3 className="font-medium text-zinc-900 dark:text-zinc-100 max-w-4/5 truncate">
                {task.title}
              </h3>
              {showLabels && <TaskCardLabels taskId={task.id} />}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 mt-auto">
              {showAssignees &&
                (task.userId ? (
                  <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-zinc-100/50 dark:bg-zinc-800/50 group-hover:bg-zinc-100 dark:group-hover:bg-zinc-800/80 transition-colors"
                    title={task.assigneeName ?? ""}
                  >
                    <span className="text-xs text-zinc-600 dark:text-zinc-400 truncate max-w-[100px]">
                      {task.assigneeName}
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
                ))}

              {showDueDates && (
                <div
                  className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-colors ${dueDateStatusColors[getDueDateStatus(task.dueDate)]} group-hover:opacity-80`}
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
                  <span className="text-xs">
                    {task.dueDate
                      ? format(new Date(task.dueDate), "MMM d")
                      : "No due date"}
                  </span>
                </div>
              )}

              {showPriority && (
                <div className="flex-shrink-0">
                  <span
                    className={`text-xs px-2 py-1 rounded-full ${priorityColorsTaskCard[task.priority as keyof typeof priorityColorsTaskCard]}`}
                  >
                    <Flag className="w-3 h-3 inline-block mr-1" />
                    {task.priority}
                  </span>
                </div>
              )}
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
