import { isBefore, isToday, startOfToday } from "date-fns";
import { type JSX, useLayoutEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import TaskContextMenu from "@/components/task/task-context-menu";
import { cn } from "@/lib/cn";
import { formatDate, formatDateShort } from "@/lib/format";
import {
  type CalendarTask,
  getCalendarTaskStatusClass,
} from "./calendar-task-bar";
import { buildMonthAgenda } from "./month-agenda-model";

type MonthAgendaProps = {
  tasks: CalendarTask[];
  visibleMonth: Date;
  projectSlug?: string;
  onOpenTask: (taskId: string) => void;
};

// Phone layout for the calendar: a seven-column month grid leaves bars a few
// characters wide, so small screens get a day-by-day list instead.
export default function MonthAgenda({
  tasks,
  visibleMonth,
  projectSlug,
  onOpenTask,
}: MonthAgendaProps): JSX.Element {
  const { t } = useTranslation();
  const agenda = useMemo(
    () => buildMonthAgenda(visibleMonth, tasks),
    [visibleMonth, tasks],
  );
  // Open at today (or the next scheduled day) rather than the 1st.
  const today = startOfToday();
  const anchorIndex = agenda.findIndex(({ day }) => !isBefore(day, today));
  const listRef = useRef<HTMLOListElement>(null);
  const anchorRef = useRef<HTMLLIElement>(null);
  // Re-anchor only when the month changes, not on every task edit.
  useLayoutEffect(() => {
    const list = listRef.current;
    const anchor = anchorRef.current;
    if (!list) return;
    list.scrollTop = anchor ? anchor.offsetTop : 0;
  }, [visibleMonth]);

  if (agenda.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center px-6 py-12">
        <p className="text-sm text-muted-foreground">
          {t("tasks:calendar.noTasksThisMonth")}
        </p>
      </div>
    );
  }

  return (
    <ol ref={listRef} className="relative min-h-0 flex-1 overflow-y-auto">
      {agenda.map(({ day, tasks: dayTasks }, index) => {
        const isCurrentDay = isToday(day);
        return (
          <li
            key={day.toISOString()}
            ref={index === anchorIndex ? anchorRef : undefined}
            className="border-b border-border/70"
          >
            <h3
              className={cn(
                "sticky top-0 z-10 flex items-baseline gap-2 bg-background/95 px-4 pt-3 pb-1.5 text-xs font-medium text-muted-foreground backdrop-blur",
                isCurrentDay && "text-foreground",
              )}
            >
              <span className="text-sm font-semibold tabular-nums">
                {formatDate(day, { day: "numeric" })}
              </span>
              <span>
                {isCurrentDay
                  ? t("tasks:calendar.today")
                  : formatDate(day, { weekday: "long" })}
              </span>
            </h3>
            <ul className="flex flex-col gap-1.5 px-3 pb-3">
              {dayTasks.map((task) => {
                const taskKey =
                  projectSlug && task.number != null
                    ? `${projectSlug}-${task.number}`
                    : undefined;
                const range = `${formatDateShort(task.scheduleStart)} – ${formatDateShort(task.scheduleEnd)}`;
                return (
                  <li key={task.id}>
                    <TaskContextMenu task={task} projectId={task.projectId}>
                      <button
                        type="button"
                        onClick={() => onOpenTask(task.id)}
                        aria-label={t("tasks:calendar.taskAriaLabel", {
                          title: task.title,
                          range,
                        })}
                        data-task-status={task.status}
                        className={cn(
                          "flex min-h-11 w-full flex-col justify-center gap-0.5 rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                          getCalendarTaskStatusClass(task.status),
                        )}
                      >
                        <span className="text-sm font-medium text-foreground">
                          {task.title}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {taskKey ? `${taskKey} · ${range}` : range}
                        </span>
                      </button>
                    </TaskContextMenu>
                  </li>
                );
              })}
            </ul>
          </li>
        );
      })}
    </ol>
  );
}
