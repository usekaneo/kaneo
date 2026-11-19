import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateFilterEditor } from "./date-filter-editor";
import { FilterSubjectPanel } from "./filter-subject-panel";
import type { FilterSubject } from "./filter-subject";
import { formatChipValue } from "./format-chip-value";

export function FilterValueButton({ subject }: { subject: FilterSubject }) {
  const { t } = useTranslation();
  // Controlled so applying a date condition can close the popup.
  const [open, setOpen] = useState(false);
  const chosen = subject.selected.map(
    (value) =>
      subject.options.find((option) => option.value === value) ?? {
        value,
        label: value,
        icon: undefined,
      },
  );
  const icons = chosen.filter((option) => option.icon).slice(0, 3);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <button
            type="button"
            className="flex h-full min-w-0 items-center gap-1.5 px-2 font-medium text-foreground outline-none hover:bg-accent focus-visible:bg-accent data-popup-open:bg-accent"
          />
        }
      >
        {icons.length > 0 && (
          <span className="inline-flex shrink-0 items-center -space-x-1">
            {icons.map((option) => (
              <span
                key={option.value}
                className="inline-flex size-4 items-center justify-center rounded-full bg-background [&>svg]:size-3.5"
              >
                {option.icon}
              </span>
            ))}
          </span>
        )}
        <span className="truncate">
          {formatChipValue(
            chosen.map((option) => option.label),
            (count) => t("tasks:boardFilters.selectedCount", { count }),
          )}
        </span>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-64">
        {subject.onDateApply ? (
          <DateFilterEditor
            selected={subject.selected}
            onApply={(value) => {
              subject.onDateApply?.(value);
              setOpen(false);
            }}
          />
        ) : (
          <FilterSubjectPanel subject={subject} />
        )}
      </PopoverContent>
    </Popover>
  );
}
