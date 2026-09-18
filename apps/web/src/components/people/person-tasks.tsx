import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import type { PersonTask } from "@/fetchers/people/get-person-tasks";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { formatHours } from "@/lib/format-duration";

type Props = {
  workspaceId: string;
  tasks: PersonTask[];
};

function isOverdue(task: PersonTask, now: Date) {
  return !task.done && task.dueDate !== null && new Date(task.dueDate) < now;
}

function TaskRow({
  task,
  workspaceId,
  now,
}: {
  task: PersonTask;
  workspaceId: string;
  now: Date;
}) {
  const overdue = isOverdue(task, now);
  return (
    <li className="flex items-center gap-3 rounded-md px-2 py-1.5 text-sm hover:bg-accent/50">
      <span className="w-16 shrink-0 text-xs text-muted-foreground">
        {task.number !== null
          ? `${task.projectSlug}-${task.number}`
          : task.projectSlug}
      </span>
      <Link
        to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
        params={{ workspaceId, projectId: task.projectId, taskId: task.id }}
        className={cn(
          "min-w-0 flex-1 truncate hover:underline",
          task.done && "text-muted-foreground line-through",
        )}
      >
        {task.title}
      </Link>
      <span className="hidden w-32 shrink-0 truncate text-xs text-muted-foreground sm:block">
        {task.projectName}
      </span>
      <span
        className={cn(
          "w-16 shrink-0 text-right text-xs",
          overdue ? "text-destructive" : "text-muted-foreground",
        )}
      >
        {task.dueDate ? formatDateShort(task.dueDate) : ""}
      </span>
      <span className="w-24 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {task.estimateMinutes
          ? `${formatHours(task.trackedSeconds)} / ${formatHours(task.estimateMinutes * 60)}`
          : task.trackedSeconds > 0
            ? formatHours(task.trackedSeconds)
            : ""}
      </span>
    </li>
  );
}

export function PersonTasks({ workspaceId, tasks }: Props) {
  const { t } = useTranslation();
  const now = new Date();
  const open = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);

  if (tasks.length === 0) {
    return (
      <p className="px-2 py-4 text-sm text-muted-foreground">
        {t("people:tasks.empty")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <section>
        <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground">
          {t("people:tasks.open", { count: open.length })}
        </h3>
        <ul>
          {open.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              workspaceId={workspaceId}
              now={now}
            />
          ))}
        </ul>
      </section>
      {done.length > 0 && (
        <section>
          <h3 className="mb-1 px-2 text-xs font-medium text-muted-foreground">
            {t("people:tasks.recentlyDone", { count: done.length })}
          </h3>
          <ul>
            {done.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                workspaceId={workspaceId}
                now={now}
              />
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export function taskCounts(tasks: PersonTask[]) {
  const now = new Date();
  return {
    open: tasks.filter((task) => !task.done).length,
    overdue: tasks.filter((task) => isOverdue(task, now)).length,
    projects: new Set(tasks.filter((t) => !t.done).map((t) => t.projectName))
      .size,
  };
}
