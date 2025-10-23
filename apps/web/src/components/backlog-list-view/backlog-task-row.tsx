import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar, CalendarClock, CalendarX } from "lucide-react";
import { type CSSProperties, useMemo } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { cn } from "@/lib/cn";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { getPriorityIcon } from "@/lib/priority";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
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
  const { data: workspace } = useActiveWorkspace();
  const {
    showAssignees,
    showPriority,
    showDueDates,
    showLabels,
    showTaskNumbers,
  } = useUserPreferencesStore();

  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );

  const assignee = useMemo(() => {
    return workspaceUsers?.members?.find(
      (member) => member.userId === task.userId,
    );
  }, [workspaceUsers, task.userId]);

  const style: CSSProperties = {
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
          {/* biome-ignore lint/a11y/noStaticElementInteractions: false positive for onClick and onKeyDown */}
          <div
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className="group relative flex items-center gap-3 px-4 py-1.5 hover:bg-zinc-100/60 dark:hover:bg-zinc-800/20 transition-colors cursor-pointer"
            {...attributes}
            {...listeners}
          >
            {showPriority && (
              <div className="flex-shrink-0 first:[&_svg]:h-4 first:[&_svg]:w-4">
                {getPriorityIcon(task.priority ?? "")}
              </div>
            )}
            {showTaskNumbers && (
              <div className="text-xs font-mono text-zinc-400 dark:text-zinc-500 flex-shrink-0">
                {project?.slug}-{task.number}
              </div>
            )}

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

            {showDueDates && task.dueDate && (
              <div
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded flex-shrink-0 ${dueDateStatusColors[getDueDateStatus(task.dueDate)]}`}
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

            {showAssignees && (
              <div className="flex-shrink-0">
                {task.userId ? (
                  <Avatar className="h-6 w-6">
                    <AvatarImage
                      src={assignee?.user?.image ?? ""}
                      alt={assignee?.user?.name || ""}
                    />
                    <AvatarFallback className="text-xs font-medium border border-border/30">
                      {assignee?.user?.name?.charAt(0).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
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
