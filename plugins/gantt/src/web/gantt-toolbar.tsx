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
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <h1 className="text-sm font-semibold text-foreground">
            {t("title")}
          </h1>
        </div>

        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder={t("searchPlaceholder")}
            className="h-9 min-h-11 touch-manipulation sm:h-8 sm:min-h-0 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-xs"
          />
        </div>

        {timeline && (
          <GanttPeriodNav timeline={timeline} onShowDate={onShowDate} />
        )}

        <Button
          variant="outline"
          size="xs"
          className="min-h-11 touch-manipulation sm:min-h-0"
          onClick={onJumpToToday}
          disabled={!canJumpToToday}
        >
          <Calendar className="size-3.5" />
          {t("jumpToToday")}
        </Button>

        <Button
          variant="outline"
          size="xs"
          className="min-h-11 touch-manipulation sm:hidden"
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
  );
}
