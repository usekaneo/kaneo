import { priorityColorsTaskCard } from "@/constants/priority-colors";
import { cn } from "@/lib/cn";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar, CalendarClock, CalendarX, Flag, User } from "lucide-react";
import TaskCardContextMenuContent from "../kanban-board/task-card-context-menu/task-card-context-menu-content";
import TaskCardLabels from "../kanban-board/task-labels";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";

interface BacklogTaskRowProps {
  task: Task;
}

export default function BacklogTaskRow({ task }: BacklogTaskRowProps) {
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
  const {
    showAssignees,
    showPriority,
    showDueDates,
    showLabels,
    showTaskNumbers,
  } = useUserPreferencesStore();

  const style = {
    transform: CSS.Transform.toString(transform),
    transition:
      transition || "transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)",
    touchAction: "none",
  };

  const handleClick = (e: React.MouseEvent) => {
    if (!project || !task) return;
    if (e.defaultPrevented) return;

    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: project.workspaceId,
        projectId: project.id,
        taskId: task.id,
      },
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleClick(e as unknown as React.MouseEvent);
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-zinc-200/50 dark:border-zinc-800/50 transition-all duration-200",
        isDragging && "opacity-50",
      )}
    >
      <ContextMenu>
        <ContextMenuTrigger asChild>
          <div
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className="group relative flex items-center gap-3 px-4 py-1.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/20 transition-colors cursor-pointer"
            {...attributes}
            {...listeners}
          >
            {/* Task ID */}
            {showTaskNumbers && (
              <div className="text-xs font-mono text-zinc-400 dark:text-zinc-500 w-16 flex-shrink-0">
                {project?.slug}-{task.number}
              </div>
            )}

            {showPriority && (
              <div className="flex-shrink-0">
                <Flag
                  className={cn(
                    "w-3 h-3",
                    priorityColorsTaskCard[
                      task.priority as keyof typeof priorityColorsTaskCard
                    ],
                  )}
                />
              </div>
            )}

            {/* Task Title and Labels */}
            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="flex items-center gap-2 justify-between w-full">
                <span className="text-sm text-zinc-900 dark:text-zinc-100 truncate">
                  {task.title}
                </span>
                {showLabels && (
                  <div className="flex items-center gap-1">
                    <TaskCardLabels taskId={task.id} />
                  </div>
                )}
              </div>
            </div>

            {/* Due Date */}
            {showDueDates && task.dueDate && (
              <div
                className={cn(
                  "flex items-center gap-1 text-xs px-1.5 py-0.5 rounded flex-shrink-0",
                  dueDateStatusColors[getDueDateStatus(task.dueDate)],
                )}
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

            {/* Assignee */}
            {showAssignees && (
              <div className="flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400 flex-shrink-0">
                <User className="w-3 h-3" />
                <span className="truncate max-w-[100px]">
                  {task.assigneeName ||
                    task.userEmail?.split("@")[0] ||
                    "Unassigned"}
                </span>
              </div>
            )}
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
