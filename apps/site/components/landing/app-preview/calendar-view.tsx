import {
  addMonths,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectWithTasks } from "@/types/project";
import type Task from "@/types/task";
import messages from "../../../../../i18n/en-US.json";
import { buildMonthWeeks, packWeekLanes } from "./calendar-model";

const copy = messages.tasks.calendar;
// Matches the status colors used by the app's CalendarTaskBar.
const statusClasses: Record<string, string> = {
  "to-do": "border-slate-500/35 bg-slate-500/15 hover:bg-slate-500/20",
  "in-progress": "border-blue-500/35 bg-blue-500/15 hover:bg-blue-500/20",
  "in-review": "border-amber-500/40 bg-amber-500/15 hover:bg-amber-500/20",
  done: "border-emerald-500/35 bg-emerald-500/15 hover:bg-emerald-500/20",
};

export function PreviewCalendar({
  project,
  onTaskClick,
}: {
  project: ProjectWithTasks;
  onTaskClick: (task: Task) => void;
}) {
  const [month, setMonth] = useState(() => new Date());
  const weeks = useMemo(() => buildMonthWeeks(month, 1), [month]);
  const tasks = useMemo(
    () =>
      project.columns
        .flatMap((column) => column.tasks)
        .flatMap((task) => {
          const start = task.startDate ?? task.dueDate;
          const end = task.dueDate ?? task.startDate;
          if (!start || !end) return [];
          const first = parseISO(start);
          const last = parseISO(end);
          return [
            {
              ...task,
              scheduleStart: first < last ? first : last,
              scheduleEnd: first < last ? last : first,
            },
          ];
        }),
    [project],
  );
  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex items-center justify-between gap-3 border-b border-border/80 px-4 py-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold">{copy.title}</h2>
          <span className="text-sm text-muted-foreground">
            {format(month, "MMMM yyyy")}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={copy.previousMonth}
            onClick={() => setMonth((value) => addMonths(value, -1))}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="xs"
            onClick={() => setMonth(new Date())}
          >
            {copy.today}
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            aria-label={copy.nextMonth}
            onClick={() => setMonth((value) => addMonths(value, 1))}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-auto">
        <div className="sticky top-0 z-20 grid grid-cols-7 border-b border-border bg-background/95">
          {weeks[0].map((day) => (
            <div
              key={day.toISOString()}
              className="border-r border-border/60 px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
            >
              {format(day, "EEE")}
            </div>
          ))}
        </div>
        {weeks.map((week) => {
          // Sample projects are small; give every overlapping task a visible lane.
          const { segments } = packWeekLanes(week, tasks, tasks.length);
          const lanes = Math.max(
            3,
            ...segments.map((segment) => segment.lane + 1),
          );
          return (
            <div
              key={week[0].toISOString()}
              className="relative grid min-h-28 flex-1 grid-cols-7 border-b border-border/70"
              style={{
                gridTemplateRows: `28px repeat(${lanes}, min-content) 1fr`,
              }}
            >
              {week.map((day, index) => (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-w-0 border-r border-border/60",
                    isWeekend(day) && "bg-muted/25",
                  )}
                  style={{ gridColumn: index + 1, gridRow: "1 / -1" }}
                />
              ))}
              {week.map((day, index) => (
                <div
                  key={`date-${day.toISOString()}`}
                  style={{ gridColumn: index + 1, gridRow: 1 }}
                  className="z-10 flex justify-end px-1 py-1"
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full text-[11px] font-medium",
                      !isSameMonth(day, month) && "text-muted-foreground/60",
                      isToday(day) && "bg-primary text-primary-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </span>
                </div>
              ))}
              {segments.map(
                ({
                  task,
                  lane,
                  columnStart,
                  columnEnd,
                  continuesBefore,
                  continuesAfter,
                }) => (
                  <button
                    type="button"
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    title={`${project.slug}-${task.number} · ${task.title}`}
                    style={{
                      gridColumn: `${columnStart} / ${columnEnd}`,
                      gridRow: lane + 2,
                    }}
                    className={cn(
                      "z-10 mb-0.5 flex h-5 min-w-0 items-center overflow-hidden border px-1.5 text-left text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      statusClasses[task.status],
                      continuesBefore
                        ? "rounded-l-none border-l-0"
                        : "ml-1 rounded-l-md",
                      continuesAfter
                        ? "rounded-r-none border-r-0"
                        : "mr-1 rounded-r-md",
                    )}
                  >
                    <span className="truncate">{task.title}</span>
                  </button>
                ),
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
