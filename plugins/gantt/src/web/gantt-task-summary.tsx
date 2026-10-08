import { useT } from "@kaneo/plugin-sdk/web";
import { addDays, format } from "date-fns";
import type { ScheduledTask } from "./scheduled-task.js";
import type { GanttTimeline } from "./timeline.js";

type GanttTaskSummaryProps = {
  task: ScheduledTask;
  timeline: GanttTimeline;
  projectSlug: string | undefined;
  statusLabel: string;
  onOpenTask: () => void;
  onShowDate: (date: Date) => void;
};

export function GanttTaskSummary({
  task,
  timeline,
  projectSlug,
  statusLabel,
  onOpenTask,
  onShowDate,
}: GanttTaskSummaryProps) {
  const t = useT();
  const outOfRange =
    task.scheduleEnd < timeline.rangeStart ||
    task.scheduleStart > timeline.rangeEnd;

  return (
    <div className="sticky left-0 z-[11] h-full border-r border-border bg-background">
      <button
        type="button"
        className="flex min-h-[44px] w-full min-w-0 flex-col items-start justify-center gap-0.5 px-2 py-2 text-left transition-colors hover:bg-muted sm:min-h-0 sm:px-3 sm:py-1.5"
        onClick={onOpenTask}
      >
        <div className="flex w-full items-center gap-1.5">
          <span className="max-w-[7rem] truncate rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-secondary-foreground sm:max-w-none">
            {statusLabel}
          </span>
          <span className="truncate text-[10px] text-muted-foreground">
            {projectSlug}-{task.number}
          </span>
        </div>
        <p className="w-full line-clamp-1 text-xs font-medium leading-tight text-foreground">
          {task.title}
        </p>
        <p className="w-full truncate text-[11px] leading-tight text-muted-foreground">
          {format(task.scheduleStart, "MMM d, yyyy")} -{" "}
          {format(task.scheduleEnd, "MMM d, yyyy")}
          {task.assigneeName ? ` • ${task.assigneeName}` : ""}
        </p>
      </button>
      {outOfRange && (
        <button
          type="button"
          className="px-3 pb-2 text-xs text-primary underline"
          onClick={() => onShowDate(addDays(task.scheduleStart, -7))}
        >
          {t("showTaskDates")}
        </button>
      )}
    </div>
  );
}
