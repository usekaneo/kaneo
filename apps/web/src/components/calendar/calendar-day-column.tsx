import { format, isSameMonth, isToday, isWeekend } from "date-fns";
import type { DragEvent } from "react";
import { cn } from "@/lib/cn";
import CalendarTaskBar, { type CalendarTask } from "./calendar-task-bar";
import DayOverflowPopover from "./day-overflow-popover";

type CalendarDayColumnProps = {
  day: Date;
  visibleMonth: Date;
  tasks: CalendarTask[];
  showAllTasks: boolean;
  maxLanes: number;
  dropHighlighted: boolean;
  projectSlug?: string;
  draggingTaskId: string | null;
  onStartDrag?: (taskId: string, event: DragEvent<HTMLButtonElement>) => void;
  onEndDrag: () => void;
  onOpenTask: (taskId: string) => void;
};

/** Each day's cards stack independently, regardless of other days' title lengths. */
export default function CalendarDayColumn({
  day,
  visibleMonth,
  tasks,
  showAllTasks,
  maxLanes,
  dropHighlighted,
  projectSlug,
  draggingTaskId,
  onStartDrag,
  onEndDrag,
  onOpenTask,
}: CalendarDayColumnProps) {
  const visibleTasks = showAllTasks ? tasks : tasks.slice(0, maxLanes);
  const hiddenCount = tasks.length - visibleTasks.length;

  return (
    <div
      data-testid={"calendar-day-" + format(day, "yyyy-MM-dd")}
      className={cn(
        "flex min-w-0 flex-col border-r border-border/60",
        isWeekend(day) && "bg-muted/25",
        dropHighlighted && "bg-primary/15 ring-1 ring-inset ring-primary/40",
      )}
    >
      <div className="z-10 flex justify-end px-1 py-1">
        <span
          className={cn(
            "flex size-5 items-center justify-center rounded-full text-[11px] font-medium",
            !isSameMonth(day, visibleMonth) && "text-muted-foreground/60",
            isToday(day) && "bg-primary text-primary-foreground",
          )}
        >
          {format(day, "d")}
        </span>
      </div>
      <div className="flex min-w-0 flex-col pb-1">
        {visibleTasks.map((task, index) => (
          <CalendarTaskBar
            key={task.id}
            segment={{
              task,
              lane: index,
              columnStart: 1,
              columnEnd: 2,
              continuesBefore: false,
              continuesAfter: false,
            }}
            withinDay
            wrapTitle
            projectSlug={projectSlug}
            isDragging={draggingTaskId === task.id}
            onStartDrag={onStartDrag}
            onEndDrag={onEndDrag}
            onOpenTask={onOpenTask}
          />
        ))}
        {hiddenCount > 0 && (
          <DayOverflowPopover
            day={day}
            tasks={tasks}
            hiddenCount={hiddenCount}
            projectSlug={projectSlug}
            onOpenTask={onOpenTask}
          />
        )}
      </div>
    </div>
  );
}
