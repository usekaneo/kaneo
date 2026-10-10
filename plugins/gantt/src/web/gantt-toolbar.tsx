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
    <div className="border-b border-border/80 px-3 py-3 sm:px-4">
      <div className="flex flex-col gap-2 sm:gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h1 className="sr-only text-sm font-semibold text-foreground sm:not-sr-only">
          {t("title")}
        </h1>

        <div className="relative w-full lg:max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 touch-manipulation sm:h-8 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-base sm:[&_[data-slot=input]]:text-xs"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {timeline && (
            <GanttPeriodNav timeline={timeline} onShowDate={onShowDate} />
          )}

          <Button
            variant="outline"
            size="xs"
            className="h-9 touch-manipulation sm:h-auto"
            aria-label={t("jumpToToday")}
            onClick={onJumpToToday}
            disabled={!canJumpToToday}
          >
            <Calendar className="size-3.5" />
            <span className="hidden sm:inline">{t("jumpToToday")}</span>
          </Button>

          <Button
            variant="outline"
            size="xs"
            className="h-9 touch-manipulation sm:hidden"
            aria-pressed={showTaskRail}
            onClick={onToggleTaskRail}
          >
            {showTaskRail ? (
              <ChevronLeft className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            {showTaskRail ? t("hideTasks") : t("showTasks")}
          </Button>
        </div>
      </div>
    </div>
  );
}
