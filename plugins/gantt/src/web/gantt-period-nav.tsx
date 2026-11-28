import { Button } from "@kaneo/plugin-sdk/ui";
import { useT } from "@kaneo/plugin-sdk/web";
import { addDays, format } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import {
  GANTT_WINDOW_DAYS,
  type GanttTimeline,
  parseTaskDate,
} from "./timeline.js";

type GanttPeriodNavProps = {
  timeline: GanttTimeline;
  onShowDate: (date: Date) => void;
};

export function GanttPeriodNav({ timeline, onShowDate }: GanttPeriodNavProps) {
  const t = useT();

  return (
    <>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t("previousPeriod")}
        disabled={!timeline.hasPrevious}
        onClick={() =>
          onShowDate(addDays(timeline.rangeStart, -GANTT_WINDOW_DAYS))
        }
      >
        <ChevronLeft className="gantt:size-4" />
      </Button>
      <input
        type="date"
        aria-label={t("periodStart")}
        className="gantt:h-9 gantt:min-w-0 gantt:rounded-md gantt:border gantt:border-border gantt:bg-background gantt:px-2 gantt:text-base gantt:sm:h-8 gantt:sm:text-sm"
        min={format(timeline.minimumStart, "yyyy-MM-dd")}
        max={format(timeline.maximumStart, "yyyy-MM-dd")}
        value={format(timeline.rangeStart, "yyyy-MM-dd")}
        onChange={(event) => {
          const date = parseTaskDate(event.target.value);
          if (date) onShowDate(date);
        }}
      />
      <span className="gantt:hidden gantt:text-xs gantt:text-muted-foreground gantt:sm:inline">
        – {format(timeline.rangeEnd, "MMM d, yyyy")}
      </span>
      <Button
        variant="outline"
        size="icon-sm"
        aria-label={t("nextPeriod")}
        disabled={!timeline.hasNext}
        onClick={() =>
          onShowDate(addDays(timeline.rangeStart, GANTT_WINDOW_DAYS))
        }
      >
        <ChevronRight className="gantt:size-4" />
      </Button>
    </>
  );
}
