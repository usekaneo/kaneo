import { ChevronLeft } from "lucide-react";
import type { Matcher } from "react-day-picker";
import { DateLimitHint } from "./date-limit-hint";
import { MonthGrid } from "./month-grid";

type DatePickerMonthViewProps = {
  placeholder: string;
  value: Date | null;
  valueLabel: string | null;
  disabled: Matcher[];
  limit: Date | undefined;
  limitHint: string | null;
  onBack: () => void;
  onSelect: (date: Date) => void;
};

export function DatePickerMonthView({
  placeholder,
  value,
  valueLabel,
  disabled,
  limit,
  limitHint,
  onBack,
  onSelect,
}: DatePickerMonthViewProps) {
  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- Escape steps back to the list instead of closing the popover
    <div
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        event.preventDefault();
        event.stopPropagation();
        onBack();
      }}
    >
      <button
        type="button"
        onClick={onBack}
        className="flex h-10 w-full cursor-pointer items-center gap-2 border-border/80 border-b px-3 text-left text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:text-foreground"
      >
        <ChevronLeft aria-hidden="true" className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{placeholder}</span>
        {valueLabel && <span className="shrink-0 text-xs">{valueLabel}</span>}
      </button>
      <MonthGrid
        value={value}
        onSelect={onSelect}
        disabled={disabled}
        marked={limit}
      />
      {limitHint && <DateLimitHint>{limitHint}</DateLimitHint>}
    </div>
  );
}
