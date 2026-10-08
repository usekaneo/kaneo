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
    <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur">
      {showTaskRail ? (
        <div
          className="sticky left-0 z-30 shrink-0 border-r border-border bg-background px-2 py-2.5 sm:w-80 sm:px-4 sm:py-3"
          style={{
            width: isMobile ? `${railWidthRem}rem` : undefined,
          }}
        >
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            {t("taskHeader")}
          </p>
        </div>
      ) : null}
      <div
        className="grid shrink-0"
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
                "border-r border-border/70 px-0.5 py-2 text-center sm:px-1",
                isWeekend(day) && "bg-muted/25",
              )}
            >
              <div className="h-4 text-[10px] font-medium text-muted-foreground">
                {showMonth ? format(day, "MMM") : ""}
              </div>
              <div
                className={cn(
                  "mx-auto flex size-6 items-center justify-center rounded-full text-xs font-medium",
                  isCurrentDay && "bg-primary text-primary-foreground",
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
