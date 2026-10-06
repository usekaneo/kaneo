import { Link } from "@tanstack/react-router";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { AssignedTask } from "@/fetchers/task/get-assigned-tasks";
import { useLocalDay } from "@/hooks/use-local-day";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { buildWeek } from "./build-week";

type WeekStripProps = {
  tasks: AssignedTask[];
  workspaceId: string;
};

const VISIBLE_TASKS_PER_DAY = 2;

export function WeekStrip({ tasks, workspaceId }: WeekStripProps) {
  const { t } = useTranslation();
  const day = useLocalDay();
  const week = useMemo(() => buildWeek(tasks, new Date(day)), [tasks, day]);

  return (
    <div className="overflow-x-auto rounded-xl border border-border bg-card">
      <ol className="flex min-w-[46rem] divide-x divide-border/70">
        {week.map((day) => (
          <li
            key={day.date.toISOString()}
            className={cn(
              "flex min-h-28 min-w-0 flex-1 flex-col gap-2.5 px-3 py-3",
              day.isToday && "bg-muted/50",
            )}
          >
            <div className="flex items-center gap-1.5 text-xs">
              {day.isToday ? (
                <>
                  <span className="font-semibold text-foreground">
                    {t("workspace:myWork.due.today")}
                  </span>
                  {day.tasks.length > 0 && (
                    <span className="flex size-4.5 items-center justify-center rounded-full bg-foreground font-semibold text-[11px] text-background tabular-nums">
                      {day.tasks.length}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium text-muted-foreground">
                    {formatDate(day.date, { weekday: "short" })}
                  </span>
                  <span className="text-muted-foreground/80 tabular-nums">
                    {formatDate(day.date, { day: "numeric" })}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1">
              {day.tasks.slice(0, VISIBLE_TASKS_PER_DAY).map((task) => (
                <Link
                  key={task.id}
                  to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
                  params={{
                    workspaceId,
                    projectId: task.projectId,
                    taskId: task.id,
                  }}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md px-2 py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    day.isPast
                      ? "bg-destructive/8 hover:bg-destructive/12"
                      : day.isToday
                        ? "border border-border bg-background hover:bg-accent/50"
                        : "bg-muted/70 hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "font-medium text-[11px]",
                      day.isPast
                        ? "text-destructive-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {day.isPast
                      ? t("workspace:myWork.due.overdue")
                      : task.number == null
                        ? task.projectSlug
                        : `${task.projectSlug}-${task.number}`}
                  </span>
                  <span className="truncate text-foreground text-xs">
                    {task.title}
                  </span>
                </Link>
              ))}
              {day.tasks.length > VISIBLE_TASKS_PER_DAY && (
                <span className="px-2 font-medium text-[11px] text-muted-foreground">
                  {t("workspace:home.week.more", {
                    count: day.tasks.length - VISIBLE_TASKS_PER_DAY,
                  })}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
