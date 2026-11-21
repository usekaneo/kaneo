import { ArrowDownWideNarrow, ArrowUpNarrowWide } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { SortConfig, SortField } from "@/lib/sort-tasks";
import { nextSortForField, SORT_FIELDS } from "./sort-fields";
import { useSortFieldLabels } from "./use-sort-field-labels";

type SortOrderControlProps = {
  sort: SortConfig;
  onSortChange: (sort: SortConfig) => void;
};

export function SortOrderControl({
  sort,
  onSortChange,
}: SortOrderControlProps) {
  const { t } = useTranslation();
  const label = t("tasks:display.sortBy");
  const isManual = sort.field === "position";
  const fieldLabels = useSortFieldLabels();
  const directionLabel =
    sort.direction === "asc"
      ? t("tasks:sort.ascending")
      : t("tasks:sort.descending");

  return (
    <div className="flex items-center gap-2">
      <span className="flex-1 text-sm">{label}</span>
      <Select
        value={sort.field}
        onValueChange={(value) => {
          if (value) onSortChange(nextSortForField(value as SortField));
        }}
      >
        <SelectTrigger size="sm" className="w-40" aria-label={label}>
          <SelectValue>{fieldLabels[sort.field]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {SORT_FIELDS.map((field) => (
            <SelectItem key={field} value={field}>
              {fieldLabels[field]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        variant="outline"
        size="icon-sm"
        disabled={isManual}
        aria-label={`${t("tasks:sort.direction")}: ${directionLabel}`}
        title={directionLabel}
        onClick={() =>
          onSortChange({
            ...sort,
            direction: sort.direction === "asc" ? "desc" : "asc",
          })
        }
      >
        {sort.direction === "asc" ? (
          <ArrowUpNarrowWide />
        ) : (
          <ArrowDownWideNarrow />
        )}
      </Button>
    </div>
  );
}
