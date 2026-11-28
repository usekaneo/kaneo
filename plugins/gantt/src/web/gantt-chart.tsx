import type { PluginProjectColumn } from "@kaneo/plugin-sdk/web";
import { useT } from "@kaneo/plugin-sdk/web";
import { isWeekend } from "date-fns";
import { type RefObject, useRef } from "react";
import { cn } from "./cn.js";
import { GanttDayHeader } from "./gantt-day-header.js";
import { GanttTaskRow } from "./gantt-task-row.js";
import type { ScheduledTask } from "./scheduled-task.js";
import { statusLabel } from "./status-label.js";
import type { GanttTimeline } from "./timeline.js";
import { usePixelsPerDay } from "./use-pixels-per-day.js";

type GanttChartProps = {
  timeline: GanttTimeline;
  tasks: ScheduledTask[];
  columns: readonly PluginProjectColumn[];
  projectSlug: string | undefined;
  showTaskRail: boolean;
  isMobile: boolean;
  railWidthRem: number;
  todayCellRef: RefObject<HTMLDivElement | null>;
  onOpenTask: (taskId: string) => void;
  onShowDate: (date: Date) => void;
};

export function GanttChart({
  timeline,
  tasks,
  columns,
  projectSlug,
  showTaskRail,
  isMobile,
  railWidthRem,
  todayCellRef,
  onOpenTask,
  onShowDate,
}: GanttChartProps) {
  const t = useT();
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const pixelsPerDay = usePixelsPerDay(timelineTrackRef, timeline);
  const railOffsetRem = showTaskRail ? railWidthRem : 0;

  return (
    <div
      data-testid="gantt-scroll-container"
      className="gantt:min-h-0 gantt:flex-1 gantt:overflow-auto gantt:overscroll-x-contain gantt:[-webkit-overflow-scrolling:touch]"
      style={{ scrollPaddingLeft: `${railOffsetRem}rem` }}
    >
      <div className="gantt:relative gantt:min-w-max gantt:touch-pan-x gantt:touch-pan-y">
        <GanttDayHeader
          timeline={timeline}
          showTaskRail={showTaskRail}
          isMobile={isMobile}
          railWidthRem={railWidthRem}
          todayCellRef={todayCellRef}
        />

        <div className="gantt:relative">
          <div
            ref={timelineTrackRef}
            className="gantt:absolute gantt:inset-y-0 gantt:z-0 gantt:grid"
            style={{
              left: `${railOffsetRem}rem`,
              gridTemplateColumns: timeline.gridTemplateColumns,
              width: `${timeline.timelineMinWidthRem}rem`,
            }}
          >
            {timeline.days.map((day) => (
              <div
                key={`bg-line-${day.toISOString()}`}
                className={cn(
                  "gantt:h-full gantt:min-h-0 gantt:border-r gantt:border-border/60",
                  isWeekend(day) && "gantt:bg-muted/25",
                )}
              />
            ))}
          </div>

          <div className="gantt:relative gantt:z-10 gantt:flex gantt:flex-col">
            {tasks.map((task) => (
              <GanttTaskRow
                key={task.id}
                task={task}
                timeline={timeline}
                showTaskRail={showTaskRail}
                railWidthRem={railWidthRem}
                isMobile={isMobile}
                pixelsPerDay={pixelsPerDay}
                projectSlug={projectSlug}
                statusLabel={statusLabel(task.status, columns, t)}
                onOpenTask={onOpenTask}
                onShowDate={onShowDate}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
