import { Link } from "@tanstack/react-router";
import { TaskLabels } from "@/components/kanban-board/task-labels";
import { DueDateText } from "@/components/my-work/due-date-text";
import { MemberFilterAvatar } from "@/components/project/task-filters/member-filter-avatar";
import { ParentTaskHint } from "@/components/task-chips/parent-task-hint";
import type { GlobalBoardTask } from "@/fetchers/task/get-global-board-tasks";
import { cn } from "@/lib/cn";
import { getPriorityIcon } from "@/lib/priority";

const cardBodyClass = "flex flex-col gap-1.5 rounded-lg p-2.5";

// The card's content; a link to the task except in the drag preview.
export function GlobalBoardCardBody({
  task,
  asLink = true,
  done = false,
}: {
  task: GlobalBoardTask;
  asLink?: boolean;
  /** Greyed out without chips, like completed cards on project boards. */
  done?: boolean;
}) {
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-1.5 pr-6 text-[11px] text-muted-foreground">
        <span className="flex size-3.5 shrink-0 items-center justify-center [&_svg]:size-3.5">
          {getPriorityIcon(task.priority)}
        </span>
        <span className="shrink-0 font-medium tabular-nums">
          {task.number == null
            ? task.projectSlug
            : `${task.projectSlug}-${task.number}`}
        </span>
        <ParentTaskHint parent={task.parentTask} className="max-w-[55%]" />
        <span className="min-w-0 truncate">
          {task.workspaceName} / {task.projectName}
        </span>
      </span>
      <span
        className={cn(
          "line-clamp-3 break-words text-sm leading-snug",
          done ? "text-board-title-done" : "text-foreground",
        )}
      >
        {task.title}
      </span>
      {!done && <TaskLabels labels={task.labels} />}
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
    </>
  );

  if (!asLink) return <div className={cardBodyClass}>{content}</div>;

  return (
    <Link
      to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
      params={{
        workspaceId: task.workspaceId,
        projectId: task.projectId,
        taskId: task.id,
      }}
      draggable={false}
      className={`${cardBodyClass} outline-none [-webkit-touch-callout:none] focus-visible:ring-2 focus-visible:ring-ring`}
    >
      {content}
    </Link>
  );
}
