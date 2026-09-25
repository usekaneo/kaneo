import { ChevronLeft, ChevronRight } from "lucide-react";
import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

type CalendarToolbarProps = {
  visibleMonth: Date;
  onPreviousMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
};

export default function CalendarToolbar({
  visibleMonth,
  onPreviousMonth,
  onNextMonth,
  onToday,
}: CalendarToolbarProps): JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="border-b border-border/80 px-3 py-3 sm:px-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-sm font-semibold text-foreground">
            {t("tasks:calendar.title")}
          </h1>
          <span
            className="truncate text-sm text-muted-foreground"
            data-testid="calendar-month-label"
          >
            {formatDate(visibleMonth, { month: "long", year: "numeric" })}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-1">
          <Button
            variant="outline"
            size="icon-xs"
            className="min-h-11 touch-manipulation sm:min-h-0"
            aria-label={t("tasks:calendar.previousMonth")}
            onClick={onPreviousMonth}
          >
            <ChevronLeft />
          </Button>
          <Button
            variant="outline"
            size="xs"
            className="min-h-11 touch-manipulation sm:min-h-0"
            onClick={onToday}
          >
            {t("tasks:calendar.today")}
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            className="min-h-11 touch-manipulation sm:min-h-0"
            aria-label={t("tasks:calendar.nextMonth")}
            onClick={onNextMonth}
          >
            <ChevronRight />
          </Button>
        </div>
      </div>
    </div>
  );
}
