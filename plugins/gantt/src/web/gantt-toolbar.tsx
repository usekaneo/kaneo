import { Button, Input } from "@kaneo/plugin-sdk/ui";
import { useT } from "@kaneo/plugin-sdk/web";
import { Calendar, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { GanttPeriodNav } from "./gantt-period-nav.js";
import type { GanttTimeline } from "./timeline.js";

type GanttToolbarProps = {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  timeline: GanttTimeline | null;
  onShowDate: (date: Date) => void;
  canJumpToToday: boolean;
  onJumpToToday: () => void;
  showTaskRail: boolean;
  onToggleTaskRail: () => void;
};

export function GanttToolbar({
  searchQuery,
  onSearchChange,
  timeline,
  onShowDate,
  canJumpToToday,
  onJumpToToday,
  showTaskRail,
  onToggleTaskRail,
}: GanttToolbarProps) {
  const t = useT();

  return (
    <div className="gantt:border-b gantt:border-border/80 gantt:px-3 gantt:py-3 gantt:sm:px-4">
      <div className="gantt:flex gantt:flex-col gantt:gap-2 gantt:sm:gap-3 gantt:lg:flex-row gantt:lg:items-center gantt:lg:justify-between">
        <h1 className="gantt:sr-only gantt:text-sm gantt:font-semibold gantt:text-foreground gantt:sm:not-sr-only">
          {t("title")}
        </h1>

        <div className="gantt:relative gantt:w-full gantt:lg:max-w-sm">
          <Search className="gantt:pointer-events-none gantt:absolute gantt:top-1/2 gantt:left-2.5 gantt:h-3.5 gantt:w-3.5 gantt:-translate-y-1/2 gantt:text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="gantt:h-9 gantt:touch-manipulation gantt:sm:h-8 gantt:[&_[data-slot=input]]:pl-8 gantt:[&_[data-slot=input]]:text-base gantt:sm:[&_[data-slot=input]]:text-xs"
          />
        </div>

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
    </div>
  );
}
