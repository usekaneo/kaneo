import { Plus } from "lucide-react";
import type { CSSProperties, PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";

type CalendarDayCellProps = {
  day: Date;
  style: CSSProperties;
  className: string;
  isSelected: boolean;
  onPointerDown: (day: Date, event: PointerEvent) => void;
  onSelect: (day: Date) => void;
};

export default function CalendarDayCell({
  day,
  style,
  className,
  isSelected,
  onPointerDown,
  onSelect,
}: CalendarDayCellProps) {
  const { t } = useTranslation();

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>
        <button
          type="button"
          data-calendar-day={day.getTime()}
          aria-label={t("tasks:calendar.createTaskOnDay", {
            date: formatDate(day, {
              weekday: "long",
              month: "long",
              day: "numeric",
            }),
          })}
          style={style}
          onPointerDown={(event) => onPointerDown(day, event)}
          // Pointer selection fires on release; this only handles keyboard
          // activation, which reports no click count.
          onClick={(event) => {
            if (event.detail === 0) onSelect(day);
          }}
          className={cn(
            className,
            "cursor-pointer select-none transition-colors hover:bg-accent/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring data-popup-open:bg-accent/40",
            isSelected && "bg-primary/10 hover:bg-primary/10",
          )}
        />
      </ContextMenuTrigger>
      <ContextMenuContent>
        <ContextMenuItem onClick={() => onSelect(day)}>
          <Plus />
          {t("tasks:calendar.newTask")}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
