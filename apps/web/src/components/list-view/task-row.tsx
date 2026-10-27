import { useRestoreTaskFocus } from "@/components/project/task-view-keys/use-restore-task-focus";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useNavigate } from "@tanstack/react-router";
import { ChevronRight, Trash2Icon } from "lucide-react";
import { type CSSProperties, useMemo, useState, memo } from "react";
import { useTranslation } from "react-i18next";
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
import { useDeleteTask } from "@/hooks/mutations/task/use-delete-task";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useTaskHoverPrefetch } from "@/hooks/use-task-hover-prefetch";
import { cn } from "@/lib/cn";
import { isKeyboardFocus } from "@/lib/is-keyboard-focus";
import { isOwnDomEvent } from "@/lib/is-own-dom-event";
import { isTaskCompleted } from "@/lib/due-date-status";
import { toast } from "@/lib/toast";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import TaskCardContextMenuContent from "../kanban-board/task-card-context-menu/task-card-context-menu-content";
import { ContextMenu, ContextMenuTrigger } from "../ui/context-menu";
import { TaskRowBody } from "./task-row-body";
import { EASE_OUT_CSS } from "@/lib/motion";

type TaskRowProps = {
  task: Task;
  projectSlug: string;
  // A subtask keeps its own top-level row and is repeated, indented, under
  // each expanded parent.
  /** Nesting level; 0 for a task shown in its own status group. */
  depth?: number;
  /**
   * Identifies the row rather than the task. The task id is not unique when a
   * subtask is repeated, so it cannot be used as a drag identity.
   */
  rowId?: string;
  childCount?: number;
  isExpanded?: boolean;
  onToggleExpanded?: (rowId: string) => void;
  /**
   * Keeps the toggle column present on rows that have no toggle, so titles in
   * a group containing subtasks stay on one vertical line.
   */
  reserveToggleSpace?: boolean;
  /**
   * True while this task is being dragged from another of its rows. Only the
   * top-level row is the drag source, so the repeats would otherwise sit at
   * full opacity beside it.
   */
  isTaskDragging?: boolean;
};

function TaskRow({
  task,
  projectSlug,
  depth = 0,
  rowId = task.id,
  childCount = 0,
  isExpanded = false,
  onToggleExpanded,
  reserveToggleSpace = false,
  isTaskDragging = false,
}: TaskRowProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const showToggleColumn = depth > 0 || childCount > 0 || reserveToggleSpace;
  // Only the top-level row is a drag source. A nested repeat shares its task
  // id with that row, so making it sortable would register the same id twice
  // and move the wrong row.
  const isNestedRepeat = depth > 0;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: rowId ?? task.id,
    disabled: isNestedRepeat,
    transition: { duration: 200, easing: EASE_OUT_CSS },
  });

  const { project } = useProjectStore();
  const taskIsCompleted = isTaskCompleted(task.status, project?.columns);
  const { data: workspace } = useActiveWorkspace();
  const [isDeleteTaskModalOpen, setIsDeleteTaskModalOpen] = useState<
    boolean | null
  >(null);
  const [hasOpenedMenu, setHasOpenedMenu] = useState(false);
  const { mutateAsync: deleteTask } = useDeleteTask();
  const toggleSelection = useBulkSelectionStore(
    (state) => state.toggleSelection,
  );
  const selectRange = useBulkSelectionStore((state) => state.selectRange);
  const setFocusedTask = useBulkSelectionStore((state) => state.setFocusedTask);
  useRestoreTaskFocus(task.id, useBulkSelectionStore, rowId);
  const setSelectionAnchor = useBulkSelectionStore(
    (state) => state.setSelectionAnchor,
  );
  const isTaskSelected = useBulkSelectionStore((state) =>
    state.selectedTaskIds.has(task.id),
  );
  const isTaskFocused = useBulkSelectionStore(
    (state) =>
      state.focusedTaskId === task.id &&
      (state.focusedTaskRowId
        ? state.focusedTaskRowId === rowId
        : rowId === task.id),
  );

  const hoverPrefetch = useTaskHoverPrefetch(task.id);
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
    transition: transition || `transform 200ms ${EASE_OUT_CSS}`,
    touchAction: isDragging ? "none" : "auto",
  };

  const openTask = () => {
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

  const handleClick = (e: React.MouseEvent) => {
    if (!project || !task || !isOwnDomEvent(e)) return;
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
    setFocusedTask(null, rowId);
    openTask();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.defaultPrevented || e.target !== e.currentTarget) return;
    if (e.key === "Enter" && e.shiftKey) {
      e.preventDefault();
      selectRange(task.id);
      return;
    }
    // Space activates the non-sortable repeat. Top-level rows leave Space to
    // the view's peekTask shortcut; this view has no keyboard drag sensor.
    if (isNestedRepeat && e.key === " ") {
      e.preventDefault();
      setSelectionAnchor(task.id);
      openTask();
    }
  };

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
    <div
      ref={setNodeRef}
      style={style}
      data-kaneo-sortable={isNestedRepeat ? undefined : true}
      className={cn(
        // The indent and the toggle sit beside the draggable region rather
        // than inside it: dnd-kit gives its activator role="button", and a
        // button nested in one is an ambiguous control for assistive tech.
        "group/row flex items-stretch border-b border-border/50 transition-colors duration-150",
        (isDragging || isTaskDragging) && "opacity-50",
        isTaskSelected &&
          "bg-accent/60 shadow-sm ring-1 ring-inset ring-ring/30",
        isTaskFocused && "ring-1 ring-board-card-focus ring-inset",
      )}
    >
      {showToggleColumn && (
        <div
          className={cn(
            "flex shrink-0 items-center pl-3.5",
            isTaskSelected ? "bg-accent/45" : "group-hover/row:bg-accent/60",
          )}
        >
          {depth > 0 && (
            <span
              aria-hidden="true"
              className="shrink-0"
              // Capped so a deep chain cannot push the title off the row; the
              // chevrons still convey the nesting.
              style={{ width: `${Math.min(depth, 6) * 1.25}rem` }}
            />
          )}

          {childCount > 0 ? (
            <button
              type="button"
              onClick={() => onToggleExpanded?.(rowId ?? task.id)}
              aria-expanded={isExpanded}
              // Named with the task, not just the action: several identical
              // "Show subtasks" buttons would be indistinguishable in a rotor.
              aria-label={
                isExpanded
                  ? t("tasks:listView.collapseSubtasks", { title: task.title })
                  : t("tasks:listView.expandSubtasks", { title: task.title })
              }
              className="touch-hitbox relative shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <ChevronRight
                className={cn(
                  "size-3 transition-transform duration-150 ease-out",
                  isExpanded && "rotate-90",
                )}
              />
            </button>
          ) : (
            <span aria-hidden="true" className="w-5 shrink-0" />
          )}
        </div>
      )}

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
              "group relative flex h-10 min-w-0 flex-1 cursor-pointer items-center gap-3 pr-3.5 outline-none transition-colors",
              showToggleColumn ? "pl-2" : "pl-3.5",
              isTaskSelected ? "bg-accent/45" : "group-hover/row:bg-accent/60",
            )}
            data-task-id={task.id}
            data-task-row-id={rowId}
            data-shortcut-surface
            // A repeated row opens its task like any other, so it keeps the
            // button semantics but takes none of dnd-kit's attributes: those
            // carry aria-disabled for a disabled sortable, which would tell
            // assistive technology the row cannot be used.
            {...(isNestedRepeat
              ? { role: "button" as const, tabIndex: 0 }
              : { ...attributes, ...listeners })}
            {...hoverPrefetch}
            onKeyDown={handleKeyDown}
            onFocus={(event) => {
              if (event.target !== event.currentTarget) return;
              setFocusedTask(isKeyboardFocus(event) ? task.id : null, rowId);
            }}
          >
            {depth > 0 && (
              // The indent is decorative, so nesting is otherwise inaudible: a
              // repeat and its top-level row expose identical content.
              <span className="sr-only">
                {t("tasks:listView.subtaskLevel", { level: depth })}
              </span>
            )}
            <TaskRowBody
              task={task}
              projectSlug={projectSlug}
              workspaceId={workspace?.id ?? ""}
              isCompleted={taskIsCompleted}
              assigneeName={assignee?.user?.name ?? task.assigneeName}
              assigneeImage={assignee?.user?.image}
            />
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
