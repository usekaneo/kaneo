import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { FilterSubjectPanel } from "./filter-subject-panel";
import type { FilterSubject } from "./filter-subject";
import { formatChipValue } from "./format-chip-value";

export function FilterValueButton({ subject }: { subject: FilterSubject }) {
  const { t } = useTranslation();
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
    <Popover>
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
        <FilterSubjectPanel subject={subject} />
      </PopoverContent>
    </Popover>
  );
}
