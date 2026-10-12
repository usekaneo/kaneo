import { CalendarDays, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { barButtonClass } from "./bar-button-class";
import { BarTooltip } from "./bar-tooltip";

export function BulkDueDatePopover({
  onSelect,
}: {
  onSelect: (date: Date | undefined) => void;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const label = t("tasks:dueDate.label");

  const select = (date: Date | undefined) => {
    setOpen(false);
    onSelect(date);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <BarTooltip label={label}>
        <PopoverTrigger
          render={<button type="button" className={barButtonClass} />}
        >
          <CalendarDays />
          <span className="max-lg:sr-only">{label}</span>
        </PopoverTrigger>
      </BarTooltip>
      <PopoverContent side="top" align="start" sideOffset={8} className="p-0">
        <Calendar mode="single" onSelect={select} className="bg-popover" />
        <div className="border-border/80 border-t p-1">
          <button
            type="button"
            onClick={() => select(undefined)}
            className="flex h-8 w-full items-center gap-2 rounded-md px-2 text-[13px] text-muted-foreground outline-none hover:bg-accent focus-visible:bg-accent"
          >
            <X aria-hidden="true" className="size-3.5" />
            {t("tasks:dueDate.clear")}
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
