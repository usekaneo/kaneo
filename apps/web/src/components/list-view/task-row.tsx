import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { format } from "date-fns";
import { Calendar, CalendarClock, CalendarDays, CalendarX } from "lucide-react";
import { type CSSProperties, useMemo, useState, memo } from "react";
import { useTranslation } from "react-i18next";
import { TaskProgressBadges } from "@/components/task/task-progress-badges";
import { TaskPullRequests } from "@/components/task/task-pull-requests";
import TaskAssigneePopover from "@/components/task/task-assignee-popover";
import TaskDueDatePopover from "@/components/task/task-due-date-popover";
import TaskLabelsPopover from "@/components/task/task-labels-popover";
import TaskPriorityPopover from "@/components/task/task-priority-popover";
import TaskStartDatePopover from "@/components/task/task-start-date-popover";
import TaskPropertyTrigger from "@/components/task/task-property-trigger";
import {
  AlertDialog,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useIsMobile } from "@/hooks/use-mobile";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import {
  dueDateTextColors,
  getDueDateStatus,
  isTaskCompleted,
} from "@/lib/due-date-status";
import { getInitials } from "@/lib/get-initials";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "../kanban-board/task-card-context-menu/task-card-context-menu-content";
import { TaskLabels } from "../kanban-board/task-labels";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";

type TaskRowProps = {
  task: Task;
  projectSlug: string;
};

function TaskRow({ task, projectSlug }: TaskRowProps) {
  const { t } = useTranslation();
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
  const taskIsCompleted = isTaskCompleted(task.status, project?.columns);
  const { data: workspace } = useActiveWorkspace();
  const isMobile = useIsMobile();
  const { canUpdateTasks, canAssignTasks, canUpdateLabels } =
    useWorkspacePermission();
  const canEdit = !isMobile && Boolean(workspace) && canUpdateTasks();
  const canAssign = !isMobile && Boolean(workspace) && canAssignTasks();
  const canEditLabels = !isMobile && Boolean(workspace) && canUpdateLabels();
  const {
    showAssignees,
    showPriority,
    showDueDates,
    showLabels,
    showTaskNumbers,
  } = useUserPreferencesStore();
  const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = useState<
    boolean | null
  >(null);
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false);
  const { mutateAsync: deleteTask } = useDeleteTask();
  const toggleSelection = useBulkSelectionStore(
    (state) => state.toggleSelection,
  );
  const selectRange = useBulkSelectionStore((state) => state.selectRange);
  const setSelectionAnchor = useBulkSelectionStore(
    (state) => state.setSelectionAnchor,
  );
  const isTaskSelected = useBulkSelectionStore((state) =>
    state.selectedTaskIds.has(task.id),
  );
  const isTaskFocused = useBulkSelectionStore(
    (state) => state.focusedTaskId === task.id,
  );

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
    transition: transition || "transform 200ms cubic-bezier(0.23, 1, 0.32, 1)",
    touchAction: isDragging ? "none" : "auto",
  };

  const handleClick = (e: React.MouseEvent | React.KeyboardEvent) => {
    if (!project || !task) return;
    if (e.defaultPrevented) return;

    if (e.shiftKey) {
      e.preventDefault();
      selectRange(task.id);
      return;
    }

    if (e.metaKey || e.ctrlKey) {
      e.preventDefault();
      toggleSelection(task.id);
      return;
    }

    setSelectionAnchor(task.id);
    const currentParams = new URLSearchParams(window.location.search);
    const currentTaskId = currentParams.get("taskId");

    if (currentTaskId === task.id) {
      navigate({
        to: ".",
        search: {},
      });
    } else {
      navigate({
        to: ".",
        search: { taskId: task.id },
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.target !== e.currentTarget) return;
    if (e.key === "Enter") {
      handleClick(e);
      e.preventDefault();
    } else {
      listeners?.onKeyDown?.(e);
    }
  };

  const handleDeleteTask = async () => {
    try {
      await deleteTask(task.id);
      toast.success(t("tasks:delete.success"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:delete.error"),
      );
    }
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "border-b border-border/50 transition-colors duration-150",
        isDragging && "opacity-50",
        isTaskSelected &&
          "bg-accent/60 shadow-sm ring-1 ring-inset ring-ring/30",
        isTaskFocused && "ring-2 ring-inset ring-ring/50",
      )}
    >
      <ContextMenu
        onOpenChange={(open) => {
          if (open) setHasOpenedMenu(true);
        }}
      >
        <ContextMenuTrigger asChild>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- false positive for onClick and onKeyDown */}
          <div
            onClick={handleClick}
            className={cn(
              "group relative flex items-center gap-3 px-4 py-1.5 transition-colors cursor-pointer",
              isTaskSelected ? "bg-accent/45" : "hover:bg-accent/60",
            )}
            {...attributes}
            {...listeners}
            onKeyDown={handleKeyDown}
          >
            {showPriority && (
              <TaskPropertyTrigger
                label={getPriorityLabel(task.priority ?? "no-priority")}
                className="shrink-0"
                canEdit={canEdit}
                renderEditor={(trigger) => (
                  <TaskPriorityPopover task={task} defaultOpen>
                    {trigger}
                  </TaskPriorityPopover>
                )}
              >
                <span
                  className="inline-flex h-5.5 items-center [&_svg]:size-4"
                  title={getPriorityLabel(task.priority ?? "no-priority")}
                >
                  {getPriorityIcon(task.priority ?? "")}
                </span>
              </TaskPropertyTrigger>
            )}
            {showTaskNumbers && (
              <div className="text-xs font-mono text-muted-foreground flex-shrink-0">
                {projectSlug}-{task.number}
              </div>
            )}

            <div className="flex-1 min-w-0 flex items-center gap-2">
              <div className="flex items-center gap-2 justify-between w-full">
                <span className="text-sm text-foreground truncate">
                  {task.title}
                </span>
                <div className="flex items-center gap-1">
                  <TaskProgressBadges task={task} />
                  {showLabels && Boolean(task.labels?.length) && (
                    <TaskPropertyTrigger
                      label={t("tasks:properties.labels")}
                      canEdit={canEditLabels}
                      renderEditor={(trigger) => (
                        <TaskLabelsPopover
                          task={task}
                          workspaceId={workspace?.id ?? ""}
                          defaultOpen
                        >
                          {trigger}
                        </TaskLabelsPopover>
                      )}
                    >
                      <TaskLabels labels={task.labels ?? []} />
                    </TaskPropertyTrigger>
                  )}

                  <TaskPullRequests
                    externalLinks={task.externalLinks}
                    className="border-border bg-sidebar"
                  />
                </div>
              </div>
            </div>

            {showDueDates && task.startDate && (
              <TaskPropertyTrigger
                label={t("tasks:properties.startDate")}
                className="shrink-0"
                canEdit={canEdit}
                renderEditor={(trigger) => (
                  <TaskStartDatePopover task={task} defaultOpen>
                    {trigger}
                  </TaskStartDatePopover>
                )}
              >
                <span className="flex h-5.5 items-center gap-1 text-[10px] text-muted-foreground">
                  <CalendarDays className="size-3" />
                  <span>{format(new Date(task.startDate), "MMM d")}</span>
                </span>
              </TaskPropertyTrigger>
            )}
            {showDueDates && task.dueDate && (
              <TaskPropertyTrigger
                label={t("tasks:boardFilters.subjects.dueDate")}
                className="shrink-0"
                canEdit={canEdit}
                renderEditor={(trigger) => (
                  <TaskDueDatePopover task={task} defaultOpen>
                    {trigger}
                  </TaskDueDatePopover>
                )}
              >
                <span
                  className={cn(
                    "flex h-5.5 items-center gap-1 text-[10px]",
                    dueDateTextColors[
                      getDueDateStatus(task.dueDate, taskIsCompleted)
                    ],
                  )}
                >
                  {getDueDateStatus(task.dueDate, taskIsCompleted) ===
                    "overdue" && <CalendarX className="w-3 h-3" />}
                  {getDueDateStatus(task.dueDate, taskIsCompleted) ===
                    "due-soon" && <CalendarClock className="w-3 h-3" />}
                  {(getDueDateStatus(task.dueDate, taskIsCompleted) ===
                    "far-future" ||
                    getDueDateStatus(task.dueDate, taskIsCompleted) ===
                      "no-due-date") && <Calendar className="w-3 h-3" />}
                  <span>{format(new Date(task.dueDate), "MMM d")}</span>
                </span>
              </TaskPropertyTrigger>
            )}

            {showAssignees && (
              <TaskPropertyTrigger
                label={t("tasks:boardFilters.subjects.assignee")}
                className="shrink-0"
                variant="avatar"
                canEdit={canAssign}
                renderEditor={(trigger) => (
                  <TaskAssigneePopover
                    task={task}
                    workspaceId={workspace?.id ?? ""}
                    defaultOpen
                  >
                    {trigger}
                  </TaskAssigneePopover>
                )}
              >
                {task.userId ? (
                  <Avatar className="h-5 w-5">
                    <AvatarImage
                      src={assignee?.user?.image ?? ""}
                      alt={assignee?.user?.name || ""}
                    />
                    <AvatarFallback className="text-xs font-medium border border-border/30">
                      {getInitials(assignee?.user?.name)}
                    </AvatarFallback>
                  </Avatar>
                ) : (
                  <span
                    className="w-5 h-5 rounded-full bg-muted border border-border flex items-center justify-center"
                    title={t("tasks:assignee.unassigned")}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">
                      ?
                    </span>
                  </span>
                )}
              </TaskPropertyTrigger>
            )}
          </div>
        </ContextMenuTrigger>

        {hasOpenedMenu && project && workspace && (
          <TaskCardContextMenuContent
            task={task}
            taskCardContext={{
              projectId: project.id,
              worskpaceId: workspace.id,
              workspaceSlug: workspace.slug,
            }}
            onDeleteClick={() => setIsDeleteTaskModalOpen(true)}
          />
        )}
      </ContextMenu>

      {isDeleteTaskModalOpen !== null && (
        <AlertDialog
          open={isDeleteTaskModalOpen}
          onOpenChange={setIsDeleteTaskModalOpen}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t("tasks:delete.title")}</AlertDialogTitle>
              <AlertDialogDescription>
                {t("tasks:delete.description")}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogClose render={<Button variant="outline" size="sm" />}>
                {t("common:actions.cancel")}
              </AlertDialogClose>
              <AlertDialogClose
                render={
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleDeleteTask}
                  />
                }
              >
                {t("tasks:delete.action")}
              </AlertDialogClose>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  );
}

export default memo(TaskRow);
