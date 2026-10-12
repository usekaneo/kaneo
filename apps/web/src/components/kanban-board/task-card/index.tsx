import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { CSSProperties } from "react";
import type Task from "@/types/task";
import TaskCardContent from "./task-card-content";
import { useTaskCardClick } from "./use-task-card-click";
import { EASE_OUT_CSS } from "@/lib/motion";

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
  const { handleKeyDown } = useTaskCardClick(task, listeners);

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
      {...attributes}
      {...listeners}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <TaskCardContent
        task={task}
        disableDragDrop={disableDragDrop}
        isFinalColumn={isFinalColumn}
        isDragging={isDragging}
        dragListeners={listeners}
      />
    </div>
  );
}

export default TaskCard;
