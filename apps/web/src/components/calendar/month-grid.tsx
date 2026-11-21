import { format, isSameMonth, isToday, isWeekend } from "date-fns";
import { type DragEvent, type JSX, useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import CalendarTaskBar, { type CalendarTask } from "./calendar-task-bar";
import CalendarDayColumn from "./calendar-day-column";
import DayOverflowPopover from "./day-overflow-popover";
import { packWeekLanes } from "./month-grid-model";

type MonthGridProps = {
  weeks: Date[][];
  tasks: CalendarTask[];
  visibleMonth: Date;
  maxLanes: number;
  wrapTaskTitles?: boolean;
  showAllTasks?: boolean;
  projectSlug?: string;
  onOpenTask: (taskId: string) => void;
  onMoveTask?: (taskId: string, targetDay: Date) => void;
};

export default function MonthGrid({
  weeks,
  tasks,
  visibleMonth,
  maxLanes,
  wrapTaskTitles = false,
  showAllTasks = false,
  projectSlug,
  onOpenTask,
  onMoveTask,
}: MonthGridProps): JSX.Element {
  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const [dropDayKey, setDropDayKey] = useState<string | null>(null);

  const clearDrag = () => {
    setDraggingTaskId(null);
    setDropDayKey(null);
  };

  // The week itself is the drop target, including empty days and task bars.
  const dayAtPointer = (
    event: DragEvent<HTMLDivElement>,
    week: Date[],
  ): Date | null => {
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width || week.length !== 7) return null;
    const index = Math.max(
      0,
      Math.min(6, Math.floor(((event.clientX - rect.left) / rect.width) * 7)),
    );
    return week[index] ?? null;
  };

  const weekdayTemplate = weeks[0] ?? [];
  const layouts = useMemo(
    () =>
      weeks.map((week) =>
        packWeekLanes(week, tasks, showAllTasks ? Infinity : maxLanes),
      ),
    [weeks, tasks, maxLanes, showAllTasks],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-auto overscroll-x-contain">
      <div className="sticky top-0 z-20 grid grid-cols-7 border-b border-border bg-background/95 backdrop-blur">
        {weekdayTemplate.map((day) => (
          <div
            key={`weekday-${day.toISOString()}`}
            className="border-r border-border/60 px-1 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted-foreground"
          >
            {formatDate(day, { weekday: "short" })}
          </div>
        ))}
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        {weeks.map((week, weekIndex) => {
          const { segments, hiddenCountByDay, tasksByDay } = layouts[weekIndex];
          const laneCount = showAllTasks
            ? Math.max(1, ...segments.map((segment) => segment.lane + 1))
            : maxLanes;

          return (
            <div
              key={`week-${week[0].toISOString()}`}
              className={cn(
                "relative grid min-h-24 grid-cols-7 border-b border-border/70 sm:min-h-28",
                showAllTasks || wrapTaskTitles ? "flex-none" : "flex-1",
              )}
              onDragOver={(event) => {
                if (!draggingTaskId || !onMoveTask) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
                const day = dayAtPointer(event, week);
                if (day) setDropDayKey(format(day, "yyyy-MM-dd"));
              }}
              onDrop={(event) => {
                if (!draggingTaskId || !onMoveTask) return;
                event.preventDefault();
                const day = dayAtPointer(event, week);
                const taskId = draggingTaskId;
                clearDrag();
                if (day) onMoveTask(taskId, day);
              }}
              style={{
                // Row 1 carries the date numbers, then one row per lane, then a
                // trailing row for the per-day overflow hint when capped.
                gridTemplateRows: wrapTaskTitles
                  ? undefined
                  : `auto repeat(${laneCount}, min-content) auto`,
              }}
            >
              {wrapTaskTitles &&
                week.map((day, dayIndex) => (
                  <CalendarDayColumn
                    key={day.toISOString()}
                    day={day}
                    visibleMonth={visibleMonth}
                    tasks={tasksByDay[dayIndex]}
                    maxLanes={maxLanes}
                    showAllTasks={showAllTasks}
                    dropHighlighted={dropDayKey === format(day, "yyyy-MM-dd")}
                    projectSlug={projectSlug}
                    draggingTaskId={draggingTaskId}
                    onStartDrag={
                      onMoveTask
                        ? (taskId, event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", taskId);
                            setDraggingTaskId(taskId);
                          }
                        : undefined
                    }
                    onEndDrag={clearDrag}
                    onOpenTask={onOpenTask}
                  />
                ))}

              {!wrapTaskTitles &&
                week.map((day, dayIndex) => (
                  <div
                    key={`cell-${day.toISOString()}`}
                    style={{ gridColumn: dayIndex + 1, gridRow: "1 / -1" }}
                    className={cn(
                      "min-w-0 border-r border-border/60",
                      isWeekend(day) && "bg-muted/25",
                      dropDayKey === format(day, "yyyy-MM-dd") &&
                        "bg-primary/15 ring-1 ring-inset ring-primary/40",
                    )}
                  />
                ))}

              {!wrapTaskTitles &&
                week.map((day, dayIndex) => (
                  <div
                    key={`number-${day.toISOString()}`}
                    style={{ gridColumn: dayIndex + 1, gridRow: 1 }}
                    className="z-10 flex justify-end px-1 py-1"
                  >
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full text-[11px] font-medium",
                        !isSameMonth(day, visibleMonth) &&
                          "text-muted-foreground/60",
                        isToday(day) && "bg-primary text-primary-foreground",
                      )}
                    >
                      {format(day, "d")}
                    </span>
                  </div>
                ))}

              {!wrapTaskTitles &&
                segments.map((segment) => (
                  <CalendarTaskBar
                    key={`bar-${segment.task.id}`}
                    segment={segment}
                    wrapTitle={wrapTaskTitles}
                    projectSlug={projectSlug}
                    isDragging={draggingTaskId === segment.task.id}
                    onStartDrag={
                      onMoveTask
                        ? (taskId, event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", taskId);
                            setDraggingTaskId(taskId);
                          }
                        : undefined
                    }
                    onEndDrag={clearDrag}
                    onOpenTask={onOpenTask}
                  />
                ))}

              {!wrapTaskTitles &&
                !showAllTasks &&
                week.map((day, dayIndex) =>
                  hiddenCountByDay[dayIndex] > 0 ? (
                    <div
                      key={`overflow-${day.toISOString()}`}
                      style={{
                        gridColumn: dayIndex + 1,
                        gridRow: maxLanes + 2,
                      }}
                      className="z-10 min-w-0"
                    >
                      <DayOverflowPopover
                        day={day}
                        tasks={tasksByDay[dayIndex]}
                        hiddenCount={hiddenCountByDay[dayIndex]}
                        projectSlug={projectSlug}
                        onOpenTask={onOpenTask}
                      />
                    </div>
                  ) : null,
                )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
