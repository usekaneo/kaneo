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
    <div className="gantt:sticky gantt:left-0 gantt:z-[11] gantt:h-full gantt:border-r gantt:border-border gantt:bg-background">
      <button
        type="button"
        className="gantt:flex gantt:min-h-[44px] gantt:w-full gantt:min-w-0 gantt:flex-col gantt:items-start gantt:justify-center gantt:gap-0.5 gantt:px-2 gantt:py-2 gantt:text-left gantt:transition-colors gantt:hover:bg-muted gantt:sm:min-h-0 gantt:sm:px-3 gantt:sm:py-1.5"
        onClick={onOpenTask}
      >
        <div className="gantt:flex gantt:w-full gantt:items-center gantt:gap-1.5">
          <span className="gantt:max-w-[7rem] gantt:truncate gantt:rounded-full gantt:bg-secondary gantt:px-1.5 gantt:py-px gantt:text-[10px] gantt:font-medium gantt:uppercase gantt:tracking-wide gantt:text-secondary-foreground gantt:sm:max-w-none">
            {statusLabel}
          </span>
          <span className="gantt:truncate gantt:text-[10px] gantt:text-muted-foreground">
            {projectSlug}-{task.number}
          </span>
        </div>
        <p className="gantt:w-full gantt:line-clamp-1 gantt:text-xs gantt:font-medium gantt:leading-tight gantt:text-foreground">
          {task.title}
        </p>
        <p className="gantt:w-full gantt:truncate gantt:text-[11px] gantt:leading-tight gantt:text-muted-foreground">
          {format(task.scheduleStart, "MMM d, yyyy")} -{" "}
          {format(task.scheduleEnd, "MMM d, yyyy")}
          {task.assigneeName ? ` • ${task.assigneeName}` : ""}
        </p>
      </button>
      {outOfRange && (
        <button
          type="button"
          className="gantt:px-3 gantt:pb-2 gantt:text-xs gantt:text-primary gantt:underline"
          onClick={() => onShowDate(addDays(task.scheduleStart, -7))}
        >
          {t("showTaskDates")}
        </button>
      )}
    </div>
  );
}
