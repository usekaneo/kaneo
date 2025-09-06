import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import useWorkspaceStore from "@/store/workspace";
import type Task from "@/types/task";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar, CalendarClock, CalendarX } from "lucide-react";
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
            className={`group bg-card border border-border rounded-lg p-3 cursor-move transition-all duration-200 ease-out relative ${
              isDragging
                ? "border-primary/30 shadow-lg shadow-primary/10 bg-card/90"
                : "hover:border-border/70 hover:shadow-sm"
            }`}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleTaskCardClick();
            }}
          >
            {/* Task Number */}
            {showTaskNumbers && (
              <div className="text-[10px] font-mono text-muted-foreground mb-2">
                {project?.slug}-{task.number}
              </div>
            )}

            {showAssignees && (
              <div className="absolute top-3 right-3">
                {task.userId ? (
                  <div
                    className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center"
                    title={task.assigneeName ?? ""}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">
                      {task.assigneeName?.charAt(0)?.toUpperCase() || "U"}
                    </span>
                  </div>
                ) : (
                  <div
                    className="w-6 h-6 rounded-full bg-muted border border-border flex items-center justify-center"
                    title="Unassigned"
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">
                      ?
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Title */}
            <div className="mb-3 pr-7">
              <h3
                className="font-medium text-foreground text-xs leading-relaxed overflow-hidden break-words"
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  wordBreak: "break-word",
                  hyphens: "auto",
                }}
              >
                {task.title}
              </h3>
            </div>

            {/* Labels */}
            {showLabels && (
              <div className="mb-3">
                <TaskCardLabels taskId={task.id} />
              </div>
            )}

            {/* Footer with priority and due date */}
            <div className="flex items-center justify-between gap-2">
              {showPriority && (
                <div className="flex-shrink-0">
                  <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded border border-border bg-background text-[10px] font-medium text-muted-foreground">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        task.priority === "high"
                          ? "bg-red-500"
                          : task.priority === "medium"
                            ? "bg-yellow-500"
                            : "bg-green-500"
                      }`}
                    />
                    {task?.priority && (
                      <span className="capitalize">{task.priority}</span>
                    )}
                  </span>
                </div>
              )}

              {showDueDates && task.dueDate && (
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
