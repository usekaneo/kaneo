import { useDraggable } from "@dnd-kit/core";
import { useNavigate } from "@tanstack/react-router";
import { Check, MoreHorizontal } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AssigneeAvatar } from "@/components/task/properties/assignee-avatar";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Menu, MenuPopup, MenuTrigger } from "@/components/ui/menu";
import { isOwnDomEvent } from "@/lib/is-own-dom-event";
import { cn } from "@/lib/cn";
import { getPriorityIcon } from "@/lib/priority";
import useBulkSelectionStore from "@/store/bulk-selection";
import useProjectStore from "@/store/project";
import type Task from "@/types/task";
import {
  SprintTaskContextMenuItems,
  SprintTaskMenuItems,
  useSprintTaskMenu,
} from "./sprint-task-menu";

type SprintTaskItemProps = {
  task: Task;
  projectId: string;
  // Dragging moves the task (or the whole selection) to another sprint.
  draggable?: boolean;
  onRequestDelete: (taskIds: string[]) => void;
};

// One row of the sprint overview: click opens the task, ctrl/cmd or shift
// selects, dragging moves it between sprints, and the three-dot button or a
// right click opens its settings menu.
export function SprintTaskItem({
  task,
  projectId,
  draggable = true,
  onRequestDelete,
}: SprintTaskItemProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const projectSlug = useProjectStore((state) => state.project?.slug);
  const projectColumns = useProjectStore((state) => state.project?.columns);
  const selectedTaskIds = useBulkSelectionStore(
    (state) => state.selectedTaskIds,
  );
  const isSelected = selectedTaskIds.has(task.id);
  const isSelectMode = useBulkSelectionStore((state) => state.isSelectMode);
  const toggleSelection = useBulkSelectionStore(
    (state) => state.toggleSelection,
  );
  const selectRange = useBulkSelectionStore((state) => state.selectRange);
  const setSelectionAnchor = useBulkSelectionStore(
    (state) => state.setSelectionAnchor,
  );

  const targets = useMemo(
    () =>
      selectedTaskIds.has(task.id) && selectedTaskIds.size > 1
        ? Array.from(selectedTaskIds)
        : [task.id],
    [selectedTaskIds, task.id],
  );

  const menu = useSprintTaskMenu({
    task,
    projectId,
    targets,
    onRequestDelete,
  });

  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: task.id,
    disabled: !draggable,
  });

  const isDone =
    projectColumns?.some(
      (column) => column.isFinal && column.id === task.status,
    ) ?? false;

  const statusName =
    projectColumns?.find((column) => column.id === task.status)?.name ??
    (task.status === "planned" ? t("tasks:sprints.backlog") : null);

  const handleClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!isOwnDomEvent(event)) return;

    if (event.shiftKey) {
      event.preventDefault();
      selectRange(task.id);
      return;
    }

    if (event.metaKey || event.ctrlKey) {
      event.preventDefault();
      toggleSelection(task.id);
      return;
    }

    setSelectionAnchor(task.id);
    navigate({ to: ".", search: { taskId: task.id } });
  };

  const rowClassName = cn(
    "flex w-full items-center gap-2 rounded-md px-3 py-1 text-left text-xs text-foreground/90 transition-colors",
    "hover:bg-accent/60 hover:text-foreground",
    isSelected && "bg-accent",
    isDragging && "opacity-60",
    "group/row",
  );

  return (
    <ContextMenu>
      <ContextMenuTrigger
        asChild
        onKeyDown={(event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.defaultPrevented || event.target !== event.currentTarget) {
            return;
          }
          if (event.key === "Enter" && event.shiftKey) {
            event.preventDefault();
            selectRange(task.id);
          }
        }}
      >
        <div
          ref={setNodeRef}
          data-task-id={task.id}
          data-shortcut-surface
          role="button"
          tabIndex={0}
          onClick={handleClick}
          className={rowClassName}
          title={task.title}
          {...attributes}
          {...listeners}
        >
          <button
            type="button"
            aria-label={
              isSelected
                ? t("tasks:bulk.clearSelection")
                : t("tasks:sprints.selectTask")
            }
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border border-border text-transparent transition-colors hover:border-foreground",
              "pointer-events-none opacity-0 group-hover/row:pointer-events-auto group-hover/row:opacity-100",
              (isSelectMode || isSelected) && "pointer-events-auto opacity-100",
              isSelected && "border-primary bg-primary text-primary-foreground",
            )}
            onClick={(event) => {
              event.stopPropagation();
              toggleSelection(task.id);
            }}
          >
            <Check className="size-3" />
          </button>
          <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">
            {getPriorityIcon(task.priority ?? "")}
          </span>
          {projectSlug && (
            <span className="shrink-0 font-mono text-muted-foreground">
              {projectSlug}-{task.number}
            </span>
          )}
          <span
            className={cn(
              "min-w-0 flex-1 truncate",
              isDone && "text-muted-foreground line-through",
            )}
          >
            {task.title}
          </span>
          {statusName && (
            <span className="ml-auto shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
              {statusName}
            </span>
          )}
          {(task.userId || task.assigneeName) && (
            <span
              className="flex shrink-0 items-center gap-1"
              title={task.assigneeName ?? undefined}
            >
              <AssigneeAvatar
                name={task.assigneeName}
                image={task.assigneeImage ?? null}
                assigned={Boolean(task.userId)}
                className="size-4"
                fallbackClassName="text-[7px]"
              />
              {task.assigneeName && (
                <span className="hidden max-w-24 truncate text-[10px] text-muted-foreground sm:inline">
                  {task.assigneeName}
                </span>
              )}
            </span>
          )}
          <span
            className="shrink-0"
            onClick={(event) => event.stopPropagation()}
          >
            <Menu>
              <MenuTrigger
                render={
                  <button
                    type="button"
                    aria-label={t("tasks:sprints.openTaskMenu")}
                    className="flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  />
                }
              >
                <MoreHorizontal className="size-3.5" />
              </MenuTrigger>
              <MenuPopup align="end" sideOffset={4} className="min-w-52">
                <SprintTaskMenuItems menu={menu} />
              </MenuPopup>
            </Menu>
          </span>
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-46">
        <SprintTaskContextMenuItems menu={menu} />
      </ContextMenuContent>
    </ContextMenu>
  );
}
