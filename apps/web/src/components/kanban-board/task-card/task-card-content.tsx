import { Trash2Icon } from "lucide-react";
import { memo, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
import { Button } from "@/components/ui/button";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import { CardFieldList } from "@/components/custom-fields/card-field-list";
import { CheckboxMark } from "@/components/custom-fields/checkbox-mark";
import { AssigneeButton } from "@/components/task-chips/assignee-button";
import { ChecklistChip } from "@/components/task-chips/checklist-chip";
import { DueDateChip } from "@/components/task-chips/due-date-chip";
import { LabelChips } from "@/components/task-chips/label-chips";
import { PriorityChip } from "@/components/task-chips/priority-chip";
import { SubtasksChip } from "@/components/task-chips/subtasks-chip";
import { taskChipClass } from "@/components/task-chips/task-chip-class";
import { useTaskCardFields } from "@/components/custom-fields/use-task-card-fields";
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { cn } from "@/lib/cn";
import { isOwnDomEvent } from "@/lib/is-own-dom-event";
import { isTaskCompleted } from "@/lib/due-date-status";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "../task-card-context-menu/task-card-context-menu-content";
import { useTaskCardClick } from "./use-task-card-click";

type TaskCardContentProps = {
  task: Task;
  disableDragDrop: boolean;
  isFinalColumn?: boolean;
  isDragging: boolean;
};

function TaskCardContent({
  task,
  disableDragDrop,
  isFinalColumn,
  isDragging,
}: TaskCardContentProps) {
  const { t } = useTranslation();
  const { project } = useProjectStore();
  const taskIsCompleted =
    isFinalColumn ?? isTaskCompleted(task.status, project?.columns);
  const hasPriority = Boolean(task.priority) && task.priority !== "no-priority";
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id ?? "";
  const { mutateAsync: deleteTask } = useDeleteTask();
  const {
    showAssignees,
    showPriority,
    showDueDates,
    showLabels,
    showTaskNumbers,
    showTaskItemCounts,
  } = useUserPreferencesStore();

  const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = useState<
    boolean | null
  >(null);
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false);
  const [isPressed, setIsPressed] = useState(false);
  const isTaskSelected = useBulkSelectionStore((state) =>
    state.selectedTaskIds.has(task.id),
  );
  const isTaskFocused = useBulkSelectionStore(
    (state) => state.focusedTaskId === task.id,
  );
  const showIdRow = showTaskNumbers || showAssignees || isTaskSelected;

  const cardFields = useTaskCardFields(task.projectId, task.id);

  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);

  const assignee = useMemo(() => {
    return workspaceUsers?.members?.find(
      (member) => member.userId === task.userId,
    );
  }, [workspaceUsers, task.userId]);

  const { handleClick } = useTaskCardClick(task);

  const handleDeleteTask = async () => {
    try {
      await deleteTask(task.id);
      toast.success(t("tasks:delete.success"), { icon: Trash2Icon });
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
          {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events -- the focusable sortable wrapper owns keyboard access */}
          <div
            onClick={handleClick}
            onPointerDown={(event) => {
              if (isOwnDomEvent(event)) setIsPressed(true);
            }}
            onPointerUp={() => setIsPressed(false)}
            onPointerLeave={() => setIsPressed(false)}
            onPointerCancel={() => setIsPressed(false)}
            className={cn(
              "group relative flex flex-col rounded-[10px] border p-3 transition-[background-color,border-color,box-shadow,scale] duration-150 ease-out",
              isPressed && "scale-[0.98]",
              disableDragDrop ? "cursor-default" : "cursor-move",
              taskIsCompleted
                ? "border-board-card-done-border bg-board-card-done"
                : "border-board-card-border bg-board-card shadow-board-card",
              isDragging
                ? "border-board-card-border-hover bg-board-card shadow-[0_8px_24px_rgb(0_0_0/0.12)]"
                : !isTaskFocused && "hover:border-board-card-border-hover",
              isTaskSelected &&
                "border-board-card-selected-border bg-board-card-selected",
              isTaskFocused && "border-board-card-focus",
            )}
          >
            {showIdRow && (
              <div className="flex h-4.5 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1.5">
                  {isTaskSelected && (
                    <CheckboxMark checked className="size-3.5 shrink-0" />
                  )}
                  {showTaskNumbers && (
                    <span
                      className={cn(
                        "truncate font-mono text-[11px] leading-3.5",
                        taskIsCompleted
                          ? "text-board-id-done"
                          : "text-board-id",
                      )}
                    >
                      {project?.slug}-{task.number}
                    </span>
                  )}
                </div>
                {showAssignees && (
                  <AssigneeButton
                    task={task}
                    workspaceId={workspaceId}
                    name={assignee?.user?.name ?? task.assigneeName}
                    image={assignee?.user?.image}
                    avatarFallbackClassName={cn(
                      isTaskSelected && "bg-avatar-selected",
                      taskIsCompleted &&
                        "bg-avatar-done text-avatar-foreground-done",
                    )}
                  />
                )}
              </div>
            )}

            <div
              className={cn(
                "line-clamp-3 break-words text-[13px] leading-[18px]",
                showIdRow && "mt-1",
                taskIsCompleted
                  ? "text-board-title-done"
                  : "font-medium text-board-title",
              )}
            >
              {task.title}
            </div>

            {!taskIsCompleted && (
              <div className="mt-2.5 flex flex-wrap items-center gap-1 empty:hidden">
                {showPriority && hasPriority && <PriorityChip task={task} />}
                {showDueDates && <DueDateChip task={task} />}
                <SubtasksChip task={task} workspaceId={workspaceId} />
                {showTaskItemCounts && <ChecklistChip task={task} />}
                <TaskPullRequests
                  externalLinks={task.externalLinks}
                  className={cn(taskChipClass, "bg-transparent font-normal")}
                />
                {showLabels && (
                  <LabelChips task={task} workspaceId={workspaceId} />
                )}
                <CardFieldList
                  fields={cardFields}
                  max={2}
                  className="contents"
                />
              </div>
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
    </>
  );
}

export default memo(TaskCardContent);
