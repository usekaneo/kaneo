import { format } from "date-fns";
import {
  Calendar,
  CalendarClock,
  CalendarX,
  SlidersHorizontal,
} from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { TaskProgressBadges } from "@/components/task/task-progress-badges";
import { TaskPullRequests } from "@/components/task/task-pull-requests";
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
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/preview-card";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import useGetCustomFieldValuesByProject from "@/hooks/queries/custom-field/use-get-custom-field-values-by-project";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { cn } from "@/lib/cn";
import {
  type DueDateStatus,
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
import TaskCardContextMenuContent from "../task-card-context-menu/task-card-context-menu-content";
import { TaskLabels } from "../task-labels";
import type { DragListeners } from "./drag-listeners";
import { useTaskCardClick } from "./use-task-card-click";

const dueDateTextColors: Record<DueDateStatus, string> = {
  overdue: "text-destructive-foreground",
  "due-soon": "text-warning-foreground",
  "far-future": "text-muted-foreground",
  "no-due-date": "text-muted-foreground",
};

type TaskCardContentProps = {
  task: Task;
  disableDragDrop: boolean;
  isFinalColumn?: boolean;
  isDragging: boolean;
  dragListeners: DragListeners;
};

function TaskCardContent({
  task,
  disableDragDrop,
  isFinalColumn,
  isDragging,
  dragListeners,
}: TaskCardContentProps) {
  const { t } = useTranslation();
  const { project } = useProjectStore();
  const taskIsCompleted =
    isFinalColumn ?? isTaskCompleted(task.status, project?.columns);
  const dueDateStatus = getDueDateStatus(task.dueDate, taskIsCompleted);
  const isOverdue = dueDateStatus === "overdue";
  const hasPriority = Boolean(task.priority) && task.priority !== "no-priority";
  const { data: workspace } = useActiveWorkspace();
  const { mutateAsync: deleteTask } = useDeleteTask();
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
  const isTaskSelected = useBulkSelectionStore((state) =>
    state.selectedTaskIds.has(task.id),
  );
  const isTaskFocused = useBulkSelectionStore(
    (state) => state.focusedTaskId === task.id,
  );

  const { data: projectCustomFieldValues = [] } =
    useGetCustomFieldValuesByProject(task.projectId);

  const customFieldValues = useMemo(
    () =>
      projectCustomFieldValues
        .filter((field) => field.taskId === task.id)
        .sort((a, b) => a.fieldPosition - b.fieldPosition),
    [projectCustomFieldValues, task.id],
  );

  const activeCustomFieldValues = useMemo(
    () =>
      customFieldValues.filter((field) => {
        if (field.value === null || field.value === "") return false;
        if (field.fieldType === "multiselect") {
          try {
            const parsed = JSON.parse(field.value);
            return Array.isArray(parsed) && parsed.length > 0;
          } catch {
            return false;
          }
        }
        return true;
      }),
    [customFieldValues],
  );

  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(
    workspace?.id ?? "",
  );

  const assignee = useMemo(() => {
    return workspaceUsers?.members?.find(
      (member) => member.userId === task.userId,
    );
  }, [workspaceUsers, task.userId]);

  const { handleClick, handleKeyDown } = useTaskCardClick(task, dragListeners);

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
    <>
      <ContextMenu
        onOpenChange={(open) => {
          if (open) setHasOpenedMenu(true);
        }}
      >
        <ContextMenuTrigger asChild>
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions -- false positive for onClick and onKeyDown */}
          <div
            onClick={handleClick}
            onKeyDown={handleKeyDown}
            className={cn(
              "group relative rounded-lg border p-3 transition-[background-color,border-color,box-shadow,scale] duration-150 ease-out active:scale-[0.98]",
              disableDragDrop ? "cursor-default" : "cursor-move",
              // Finished work steps back so open cards draw the eye.
              taskIsCompleted
                ? "bg-background/60"
                : "bg-background shadow-xs/5",
              isDragging
                ? "border-ring/40 bg-card shadow-lg"
                : "hover:bg-background hover:shadow-sm",
              isTaskSelected
                ? "border-ring/40 bg-accent/50 shadow-sm ring-1 ring-inset ring-ring/30"
                : isOverdue
                  ? "border-destructive/70 ring-[3px] ring-destructive/10"
                  : "border-border hover:border-border/90",
              isTaskFocused && "ring-2 ring-inset ring-ring/50",
            )}
          >
            {showTaskNumbers && (
              <div className="mb-2 font-medium text-[11px] text-muted-foreground/90">
                {project?.slug}-{task.number}
              </div>
            )}

            {showAssignees && (
              <div className="absolute top-3 right-3">
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
                  <div
                    className="flex h-5 w-5 items-center justify-center rounded-full border border-border bg-muted"
                    title={t("tasks:assignee.unassigned")}
                  >
                    <span className="text-[10px] font-medium text-muted-foreground">
                      ?
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className={cn("pr-6", !taskIsCompleted && "mb-2.5")}>
              <div
                className={cn(
                  "overflow-hidden break-words leading-5 font-medium text-[15px]",
                  taskIsCompleted
                    ? "text-muted-foreground"
                    : "text-foreground/95",
                )}
                style={{
                  display: "-webkit-box",
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: "vertical",
                  wordBreak: "break-word",
                  hyphens: "auto",
                }}
              >
                {task.title}
              </div>
            </div>

            {!taskIsCompleted && showLabels && Boolean(task.labels?.length) && (
              <div className="mb-2.5">
                <TaskLabels labels={task.labels ?? []} />
              </div>
            )}

            <div
              className={cn(
                "flex flex-wrap items-center gap-x-2.5 gap-y-1.5 empty:hidden",
                taskIsCompleted && "hidden",
              )}
            >
              {showPriority && hasPriority && (
                <span
                  className="inline-flex h-5.5 items-center"
                  title={getPriorityLabel(task.priority ?? "")}
                >
                  {getPriorityIcon(task.priority ?? "")}
                </span>
              )}

              {activeCustomFieldValues.length > 0 && (
                <HoverCard openDelay={200} closeDelay={100}>
                  <HoverCardTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 rounded border border-border/70 bg-muted/55 px-2 py-1 text-[10px] font-medium text-muted-foreground cursor-default focus:outline-none focus:ring-2 focus:ring-ring/50 focus:ring-offset-1"
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                      aria-label={t("tasks:customFields.ariaLabel", {
                        count: activeCustomFieldValues.length,
                      })}
                    >
                      <SlidersHorizontal className="w-3 h-3" />
                      <span>{activeCustomFieldValues.length}</span>
                    </button>
                  </HoverCardTrigger>
                  <HoverCardContent
                    className="w-fit p-2.5"
                    side="bottom"
                    onClick={(e) => e.stopPropagation()}
                    onPointerDown={(e) => e.stopPropagation()}
                  >
                    <div className="space-y-1.5">
                      {activeCustomFieldValues.map((field) => {
                        const value = field.value;

                        if (!value) return null;

                        let displayValue: string = value;
                        if (field.fieldType === "multiselect") {
                          try {
                            const parsed = JSON.parse(value);
                            if (Array.isArray(parsed)) {
                              displayValue = parsed.join(", ");
                            }
                          } catch {
                            displayValue = value;
                          }
                        }

                        return (
                          <div
                            key={field.id}
                            className="flex items-center justify-between gap-2 text-xs"
                          >
                            <span className="font-medium text-muted-foreground truncate">
                              {field.fieldName}
                            </span>
                            <span className="text-foreground truncate max-w-24">
                              {displayValue}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </HoverCardContent>
                </HoverCard>
              )}

              <TaskProgressBadges task={task} />

              {showDueDates && task.dueDate && (
                <div
                  className={cn(
                    "flex h-5.5 items-center gap-1 text-[10px]",
                    isOverdue && "font-medium",
                    dueDateTextColors[dueDateStatus],
                  )}
                >
                  {dueDateStatus === "overdue" && (
                    <CalendarX className="w-3 h-3" />
                  )}
                  {dueDateStatus === "due-soon" && (
                    <CalendarClock className="w-3 h-3" />
                  )}
                  {(dueDateStatus === "far-future" ||
                    dueDateStatus === "no-due-date") && (
                    <Calendar className="w-3 h-3" />
                  )}
                  <span>{format(new Date(task.dueDate), "MMM d")}</span>
                </div>
              )}

              <TaskPullRequests externalLinks={task.externalLinks} />
            </div>
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
    </>
  );
}

export default memo(TaskCardContent);
