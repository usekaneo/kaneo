import { format } from "date-fns";
import { useMemo } from "react";
import { cn } from "@/lib/utils";
import messages from "../../../../../i18n/en-US.json";
import type { AssignedTask } from "./assigned-tasks";
import { buildWeek } from "./build-week";
import { pluralMessage } from "./fill-message";

const VISIBLE_TASKS_PER_DAY = 2;
const copy = messages.workspace;

export function WeekStrip({
  tasks,
  onTaskClick,
}: {
  tasks: AssignedTask[];
  onTaskClick: (task: AssignedTask) => void;
}) {
  const week = useMemo(() => buildWeek(tasks), [tasks]);

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card">
      <ol className="flex divide-x divide-border/70">
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
                    {copy.myWork.due.today}
                  </span>
                  {day.tasks.length > 0 && (
                    <span className="flex size-4.5 items-center justify-center rounded-full bg-foreground text-[11px] font-semibold tabular-nums text-background">
                      {day.tasks.length}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <span className="font-medium text-muted-foreground">
                    {format(day.date, "EEE")}
                  </span>
                  <span className="tabular-nums text-muted-foreground/80">
                    {format(day.date, "d")}
                  </span>
                </>
              )}
            </div>

            <div className="flex flex-col gap-1">
              {day.tasks.slice(0, VISIBLE_TASKS_PER_DAY).map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => onTaskClick(task)}
                  className={cn(
                    "flex flex-col gap-0.5 rounded-md px-2 py-1.5 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
                    day.isPast
                      ? "bg-destructive/8 hover:bg-destructive/12"
                      : day.isToday
                        ? "border border-border bg-background hover:bg-accent/50"
                        : "bg-muted/70 hover:bg-muted",
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-medium",
                      day.isPast
                        ? "text-destructive-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {day.isPast
                      ? copy.myWork.due.overdue
                      : `${task.projectSlug}-${task.number}`}
                  </span>
                  <span className="truncate text-xs text-foreground">
                    {task.title}
                  </span>
                </button>
              ))}
              {day.tasks.length > VISIBLE_TASKS_PER_DAY && (
                <span className="px-2 text-[11px] font-medium text-muted-foreground">
                  {pluralMessage(
                    {
                      one: copy.home.week.more_one,
                      other: copy.home.week.more_other,
                    },
                    day.tasks.length - VISIBLE_TASKS_PER_DAY,
                  )}
                </span>
              )}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
