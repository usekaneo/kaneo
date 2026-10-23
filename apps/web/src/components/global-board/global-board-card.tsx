import { useDraggable } from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { memo } from "react";
import { TaskLabels } from "@/components/kanban-board/task-labels";
import { DueDateText } from "@/components/my-work/due-date-text";
import { MemberFilterAvatar } from "@/components/project/task-filters/member-filter-avatar";
import type { GlobalBoardProject } from "@/fetchers/task/get-global-board-meta";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import { cn } from "@/lib/cn";
import { getPriorityIcon } from "@/lib/priority";
import type { GlobalBoardLane } from "./global-board-filters";
import { TaskMoveMenu } from "./task-move-menu";

type GlobalBoardCardProps = {
  task: GlobalBoardTask;
  lane: GlobalBoardLane;
  project?: GlobalBoardProject;
  canMove: boolean;
  onMove?: (column: GlobalBoardProject["columns"][number]) => void;
  isOverlay?: boolean;
};

function GlobalBoardCard({
  task,
  lane,
  project,
  canMove,
  onMove,
  isOverlay = false,
}: GlobalBoardCardProps) {
  // Only pointer listeners: the link and move menu inside stay the keyboard
  // and screen-reader path, so the wrapper must not become a second button.
  const { setNodeRef, listeners, isDragging } = useDraggable({
    id: task.id,
    data: { task, lane },
    disabled: !canMove || isOverlay,
  });

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      {...(isOverlay ? {} : listeners)}
      data-task-id={task.id}
      className={cn(
        "group/card relative rounded-lg border border-border/60 bg-card shadow-xs transition-[opacity,border-color] hover:border-border",
        isDragging && "opacity-40",
        canMove && "touch-manipulation",
      )}
    >
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
        params={{
          workspaceId: task.workspaceId,
          projectId: task.projectId,
          taskId: task.id,
        }}
        draggable={false}
        className="flex flex-col gap-1.5 rounded-lg p-2.5 outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex min-w-0 items-center gap-1.5 pr-6 text-[11px] text-muted-foreground">
          <span className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">
            {getPriorityIcon(task.priority)}
          </span>
          <span className="shrink-0 font-medium tabular-nums">
            {task.number == null
              ? task.projectSlug
              : `${task.projectSlug}-${task.number}`}
          </span>
          <span className="min-w-0 truncate">
            {task.workspaceName} / {task.projectName}
          </span>
        </span>
        <span className="line-clamp-3 break-words text-foreground text-sm leading-snug">
          {task.title}
        </span>
        <TaskLabels labels={task.labels} />
        {(task.dueDate || task.assignee || task.statusName) && (
          <span className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground">
            {task.statusName && (
              <span className="min-w-0 truncate">{task.statusName}</span>
            )}
            <DueDateText dueDate={task.dueDate} className="shrink-0" />
            {task.assignee && (
              <span className="ml-auto shrink-0" title={task.assignee.name}>
                <MemberFilterAvatar
                  name={task.assignee.name}
                  image={task.assignee.image}
                />
              </span>
            )}
          </span>
        )}
      </Link>
      {canMove && project && onMove && !isOverlay && (
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
