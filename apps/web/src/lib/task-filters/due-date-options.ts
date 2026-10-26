import { DUE_DATE_FILTER_VALUES } from "./due-date-filter-values";

export const DUE_DATE_OPTIONS = [
  {
    value: DUE_DATE_FILTER_VALUES.dueThisWeek,
    labelKey: "tasks:backlog.filters.dueThisWeek",
  },
  {
    value: DUE_DATE_FILTER_VALUES.dueNextWeek,
    labelKey: "tasks:backlog.filters.dueNextWeek",
  },
  {
    value: DUE_DATE_FILTER_VALUES.noDueDate,
    labelKey: "tasks:backlog.filters.noDueDate",
  },
] as const;
