import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AssignedTaskRow } from "@/components/my-work/assigned-task-row";
import type { DueBucket } from "@/components/my-work/due-bucket";
import {
  groupAssignedTasksByDueDate,
  groupAssignedTasksByProject,
} from "@/components/my-work/group-assigned-tasks";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useLocalDay } from "@/hooks/use-local-day";
import { cn } from "@/lib/cn";
import type { MyTasksGroupBy } from "./my-tasks-group-by";

type MyTasksListProps = {
  tasks: AssignedTask[];
  total: number;
  groupBy: MyTasksGroupBy;
  workspaceId: string;
};

export function MyTasksList({
  tasks,
  total,
  groupBy,
  workspaceId,
}: MyTasksListProps) {
  const { t } = useTranslation();
  const day = useLocalDay();
  const groups = useMemo(
    () =>
      groupBy === "project"
        ? groupAssignedTasksByProject(tasks)
        : groupAssignedTasksByDueDate(tasks, new Date(day)),
    [tasks, groupBy, day],
  );

  const bucketTitles: Record<DueBucket, string> = {
    overdue: t("workspace:myWork.due.overdue"),
    today: t("workspace:myWork.due.today"),
    thisWeek: t("workspace:myWork.due.thisWeek"),
    later: t("workspace:myWork.due.later"),
    noDueDate: t("workspace:myWork.due.noDueDate"),
  };

  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.id}>
          <h2 className="flex h-9 items-center gap-2 border-border/50 border-b bg-muted/40 px-5 text-[13px]">
            <span
              className={cn(
                "font-semibold",
                group.bucket === "overdue"
                  ? "text-destructive-foreground"
                  : "text-foreground",
              )}
            >
              {group.bucket ? bucketTitles[group.bucket] : group.title}
            </span>
            <span className="font-normal text-muted-foreground text-xs tabular-nums">
              {group.tasks.length}
            </span>
          </h2>
          <div className="flex flex-col px-4">
            {group.tasks.map((task) => (
              <AssignedTaskRow
                key={task.id}
                task={task}
                workspaceId={workspaceId}
                showLabels
              />
            ))}
          </div>
        </section>
      ))}
      {total > tasks.length && (
        <p className="px-5 py-3 text-muted-foreground text-xs">
          {t("workspace:myTasks.truncated", {
            shown: tasks.length,
            total,
          })}
        </p>
      )}
    </div>
  );
}
