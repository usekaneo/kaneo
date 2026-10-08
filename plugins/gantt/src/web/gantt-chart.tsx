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
      className="min-h-0 flex-1 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
      style={{ scrollPaddingLeft: `${railOffsetRem}rem` }}
    >
      <div className="relative min-w-max touch-pan-x touch-pan-y">
        <GanttDayHeader
          timeline={timeline}
          showTaskRail={showTaskRail}
          isMobile={isMobile}
          railWidthRem={railWidthRem}
          todayCellRef={todayCellRef}
        />

        <div className="relative">
          <div
            ref={timelineTrackRef}
            className="absolute inset-y-0 z-0 grid"
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
                  "h-full min-h-0 border-r border-border/60",
                  isWeekend(day) && "bg-muted/25",
                )}
              />
            ))}
          </div>

          <div className="relative z-10 flex flex-col">
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
