import { CalendarDays } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DatePickerMenu } from "@/components/common/date-picker/date-picker-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { barButtonClass } from "./bar-button-class";
import { BarTooltip } from "./bar-tooltip";
import { useBulkPickerRequest } from "./use-bulk-picker-request";

export function BulkDueDatePopover({
  onSelect,
  onDismiss,
  returnFocus,
}: {
  onSelect: (date: Date | null) => void;
  onDismiss?: () => void;
  returnFocus?: () => HTMLElement | null;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { openedByRequest, openedManually } = useBulkPickerRequest(
    "dueDate",
    setOpen,
  );
  const label = t("tasks:dueDate.label");

  const select = (date: Date | null) => {
    setOpen(false);
    onSelect(date);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) openedManually();
        else onDismiss?.();
      }}
    >
      <BarTooltip label={label}>
        <PopoverTrigger
          render={<button type="button" className={barButtonClass} />}
        >
          <CalendarDays />
          <span className="max-lg:sr-only">{label}</span>
        </PopoverTrigger>
      </BarTooltip>
      <PopoverContent
        side="top"
        align="start"
        sideOffset={8}
        className="w-65 p-0"
        finalFocus={() => (openedByRequest() && returnFocus?.()) || true}
      >
        <DatePickerMenu
          label={label}
          placeholder={t("tasks:datePicker.dueDatePlaceholder")}
          clearLabel={t("tasks:dueDate.clear")}
          value={null}
          onChange={select}
          canClear
        />
      </PopoverContent>
    </Popover>
  );
}
