import { parseISO } from "date-fns";
import { formatDateMedium } from "@/lib/format";
import type { TFunction } from "i18next";
import { parseDateCondition } from "@/lib/task-filters/date-condition";

export function formatDateCondition(value: string, t: TFunction) {
  const condition = parseDateCondition(value);
  if (!condition) return value;
  const date = formatDateMedium(parseISO(condition.date));
  switch (condition.operator) {
    case "exact":
      return t("tasks:dateFilter.exactValue", { date });
    case "before":
      return t("tasks:dateFilter.beforeValue", { date });
    case "after":
      return t("tasks:dateFilter.afterValue", { date });
    case "range":
      return t("tasks:dateFilter.rangeValue", {
        date,
        end: formatDateMedium(parseISO(condition.end!)),
      });
  }
}
