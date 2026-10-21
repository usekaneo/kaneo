import type { ProjectViewConfig } from "@/fetchers/saved-view";

type Filters = ProjectViewConfig["filters"];
export type BoardFilters = Omit<Filters, "createdDate" | "negated"> &
  Partial<Pick<Filters, "createdDate" | "negated">>;

export const DUE_DATE_FILTER_VALUES = {
  dueNextWeek: "dueNextWeek",
  dueThisWeek: "dueThisWeek",
  noDueDate: "noDueDate",
} as const;
