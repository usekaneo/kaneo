import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { type CSSProperties, memo } from "react";
import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import { cn } from "@/lib/cn";
import { EASE_OUT_CSS } from "@/lib/motion";
import { GlobalBoardCardBody } from "./global-board-card-body";
import type { GlobalBoardLane } from "./global-board-filters";
import { TaskMoveMenu } from "./task-move-menu";

type GlobalBoardCardProps = {
  task: GlobalBoardTask;
  lane: GlobalBoardLane;
  project?: GlobalBoardProject;
  canMove: boolean;
  onMove?: (column: GlobalBoardProject["columns"][number]) => void;
};

function GlobalBoardCard({
  task,
  lane,
  project,
  canMove,
  onMove,
}: GlobalBoardCardProps) {
  // Only pointer listeners: the link and move menu inside stay the keyboard
  // and screen-reader path, so the wrapper must not become a second button.
  // Everyone can drag to arrange their own board; changing lanes is checked
  // when the card enters another lane.
  const { setNodeRef, listeners, transform, transition, isDragging } =
    useSortable({
      id: task.id,
      data: { task, lane },
      transition: { duration: 200, easing: EASE_OUT_CSS },
    });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition: transition || `transform 200ms ${EASE_OUT_CSS}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      data-task-id={task.id}
      className={cn(
        "group/card relative touch-manipulation rounded-lg border border-border/60 bg-card shadow-xs transition-[opacity,border-color] hover:border-border",
        // The slot the card will drop into, while the overlay follows the pointer.
        isDragging && "border-dashed border-border opacity-40 shadow-none",
      )}
    >
      <GlobalBoardCardBody task={task} />
      {canMove && project && onMove && (
        <TaskMoveMenu
          task={task}
          columns={project.columns}
          onMove={onMove}
          className="absolute top-1.5 right-1.5"
        />
      )}
    </div>
  );
}

export default memo(GlobalBoardCard);
