import type { TFunction } from "i18next";
import { formatDateMedium, formatDateShort } from "@/lib/format";
import type { RelativeDueDate } from "@/lib/relative-due-date";

export function formatRelativeDueDate(
  relative: RelativeDueDate,
  dueDate: string | Date,
  t: TFunction,
) {
  switch (relative.kind) {
    case "overdue":
      return relative.days >= 14
        ? t("tasks:due.overdueWeeks", { count: relative.weeks })
        : t("tasks:due.overdueDays", { count: relative.days });
    case "today":
      return t("tasks:due.today");
    case "tomorrow":
      return t("tasks:due.tomorrow");
    case "soon":
      return t("tasks:due.inDays", { count: relative.days });
    case "date":
      return relative.sameYear
        ? formatDateShort(dueDate)
        : formatDateMedium(dueDate);
  }
}
