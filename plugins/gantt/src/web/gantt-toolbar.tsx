import { Button } from "@kaneo/plugin-sdk/ui";
import { useT } from "@kaneo/plugin-sdk/web";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { GanttPeriodNav } from "./gantt-period-nav.js";
import type { GanttTimeline } from "./timeline.js";

type GanttToolbarProps = {
  timeline: GanttTimeline | null;
  onShowDate: (date: Date) => void;
  canJumpToToday: boolean;
  onJumpToToday: () => void;
  showTaskRail: boolean;
  onToggleTaskRail: () => void;
};

export function GanttToolbar({
  timeline,
  onShowDate,
  canJumpToToday,
  onJumpToToday,
  showTaskRail,
  onToggleTaskRail,
}: GanttToolbarProps) {
  const t = useT();

  return (
    <div className="gantt:border-b gantt:border-border/80 gantt:px-3 gantt:py-2 gantt:sm:px-4">
      <h1 className="gantt:sr-only">{t("title")}</h1>
      <div className="gantt:flex gantt:flex-wrap gantt:items-center gantt:gap-2">
        {timeline && (
          <GanttPeriodNav timeline={timeline} onShowDate={onShowDate} />
        )}

        <Button
          variant="outline"
          size="xs"
          className="gantt:h-9 gantt:touch-manipulation gantt:sm:h-auto"
          aria-label={t("jumpToToday")}
          onClick={onJumpToToday}
          disabled={!canJumpToToday}
        >
          <Calendar className="gantt:size-3.5" />
          <span className="gantt:hidden gantt:sm:inline">
            {t("jumpToToday")}
          </span>
        </Button>

        <Button
          variant="outline"
          size="xs"
          className="gantt:h-9 gantt:touch-manipulation gantt:sm:hidden"
          aria-pressed={showTaskRail}
          onClick={onToggleTaskRail}
        >
          {showTaskRail ? (
            <ChevronLeft className="gantt:size-3.5" />
          ) : (
            <ChevronRight className="gantt:size-3.5" />
          )}
          {showTaskRail ? t("hideTasks") : t("showTasks")}
        </Button>
      </div>
    </div>
  );
}
