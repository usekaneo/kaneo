import { useT } from "@kaneo/plugin-sdk/web";
import { format, isSameMonth, isToday, isWeekend } from "date-fns";
import type { RefObject } from "react";
import { cn } from "./cn.js";
import type { GanttTimeline } from "./timeline.js";

type GanttDayHeaderProps = {
  timeline: GanttTimeline;
  showTaskRail: boolean;
  isMobile: boolean;
  railWidthRem: number;
  todayCellRef: RefObject<HTMLDivElement | null>;
};

export function GanttDayHeader({
  timeline,
  showTaskRail,
  isMobile,
  railWidthRem,
  todayCellRef,
}: GanttDayHeaderProps) {
  const t = useT();

  return (
    <div className="gantt:sticky gantt:top-0 gantt:z-20 gantt:flex gantt:border-b gantt:border-border gantt:bg-background/95 gantt:backdrop-blur">
      {showTaskRail ? (
        <div
          className="gantt:sticky gantt:left-0 gantt:z-30 gantt:shrink-0 gantt:border-r gantt:border-border gantt:bg-background gantt:px-2 gantt:py-2.5 gantt:sm:w-80 gantt:sm:px-4 gantt:sm:py-3"
          style={{
            width: isMobile ? `${railWidthRem}rem` : undefined,
          }}
        >
          <p className="gantt:text-[11px] gantt:font-medium gantt:uppercase gantt:tracking-wide gantt:text-muted-foreground">
            {t("taskHeader")}
          </p>
        </div>
      ) : null}
      <div
        className="gantt:grid gantt:shrink-0"
        style={{
          gridTemplateColumns: timeline.gridTemplateColumns,
          minWidth: `${timeline.timelineMinWidthRem}rem`,
        }}
      >
        {timeline.days.map((day, index) => {
          const showMonth =
            index === 0 || !isSameMonth(day, timeline.days[index - 1] ?? day);
          const isCurrentDay = isToday(day);

          return (
            <div
              key={day.toISOString()}
              ref={isCurrentDay ? todayCellRef : undefined}
              className={cn(
                "gantt:border-r gantt:border-border/70 gantt:px-0.5 gantt:py-2 gantt:text-center gantt:sm:px-1",
                isWeekend(day) && "gantt:bg-muted/25",
              )}
            >
              <div className="gantt:h-4 gantt:text-[10px] gantt:font-medium gantt:text-muted-foreground">
                {showMonth ? format(day, "MMM") : ""}
              </div>
              <div
                className={cn(
                  "gantt:mx-auto gantt:flex gantt:size-6 gantt:items-center gantt:justify-center gantt:rounded-full gantt:text-xs gantt:font-medium",
                  isCurrentDay &&
                    "gantt:bg-primary gantt:text-primary-foreground",
                )}
              >
                {format(day, "d")}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
