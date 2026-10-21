export const CREATED_DATE_OPTIONS = [
  { value: "today", labelKey: "tasks:boardFilters.createdDate.today" },
  { value: "thisWeek", labelKey: "tasks:boardFilters.createdDate.thisWeek" },
  { value: "last7Days", labelKey: "tasks:boardFilters.createdDate.last7Days" },
  {
    value: "last30Days",
    labelKey: "tasks:boardFilters.createdDate.last30Days",
  },
] as const;
