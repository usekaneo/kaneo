import type { ReactNode } from "react";
import type { useTaskFiltersWithLabelsSupport } from "@/hooks/use-task-filters-with-labels-support";

export type TaskFilterControls = Pick<
  ReturnType<typeof useTaskFiltersWithLabelsSupport>,
  | "filters"
  | "updateFilter"
  | "toggleFilter"
  | "setNegated"
  | "updateCustomFieldFilter"
  | "clearFilters"
  | "activeFilterCount"
>;

export type FilterOption = {
  value: string;
  label: string;
  icon?: ReactNode;
  count?: number;
};

export type FilterSubject = {
  id: string;
  label: string;
  icon: ReactNode;
  kind: "core" | "customField";
  operators: { positive: string; negative: string };
  options: FilterOption[];
  selected: string[];
  negated: boolean;
  onToggle: (value: string) => void;
  onNegate: (negated: boolean) => void;
  onClear: () => void;
  emptyLabel: string;
};
