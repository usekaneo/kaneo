import { useRestoreTaskFocus } from "@/components/project/task-view-keys/use-restore-task-focus";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import useBulkSelectionStore from "@/store/bulk-selection";
import type Task from "@/types/task";
import TaskCardContent from "./task-card-content";
import { useTaskCardClick } from "./use-task-card-click";
import { useTaskHoverPrefetch } from "@/hooks/use-task-hover-prefetch";
import { EASE_OUT_CSS } from "@/lib/motion";
import { isKeyboardFocus } from "@/lib/is-keyboard-focus";

type TaskCardProps = {
  task: Task;
  disableDragDrop?: boolean;
  isFinalColumn?: boolean;
};

function TaskCard({
  task,
  disableDragDrop = false,
  isFinalColumn,
}: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    disabled: disableDragDrop,
    data: { isFinalColumn },
    transition: { duration: 200, easing: EASE_OUT_CSS },
  });
  // The context menu trigger inside the card stops touchstart from bubbling,
  // so the TouchSensor listens on that trigger instead of this wrapper.
  const { onTouchStart, ...dragListeners } = listeners ?? {};
  const { handleKeyDown } = useTaskCardClick(task);
  const hoverPrefetch = useTaskHoverPrefetch(task.id);
  const setFocusedTask = useBulkSelectionStore((state) => state.setFocusedTask);
  useRestoreTaskFocus(task.id, useBulkSelectionStore);

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || `transform 200ms ${EASE_OUT_CSS}`,
    opacity: isDragging ? 0.6 : 1,
    touchAction: isDragging ? "none" : "auto",
    zIndex: isDragging ? 999 : "auto",
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-kaneo-sortable
      data-task-id={task.id}
      data-shortcut-surface
      {...attributes}
      {...dragListeners}
      {...hoverPrefetch}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onFocus={(event) => {
        if (event.target !== event.currentTarget) return;
        setFocusedTask(isKeyboardFocus(event) ? task.id : null);
      }}
      className="select-none outline-none"
    >
      <TaskCardContent
        task={task}
        disableDragDrop={disableDragDrop}
        isFinalColumn={isFinalColumn}
        isDragging={isDragging}
        onDragTouchStart={(event) => onTouchStart?.(event)}
      />
    </div>
  );
}

export default TaskCard;
