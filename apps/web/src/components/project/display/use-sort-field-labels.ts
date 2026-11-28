import { useTranslation } from "react-i18next";
import type { SortField } from "@/lib/sort-tasks";

export function useSortFieldLabels(): Record<SortField, string> {
  const { t } = useTranslation();
  return {
    position: t("tasks:sort.fields.position"),
    createdAt: t("tasks:sort.fields.createdAt"),
    priority: t("tasks:sort.fields.priority"),
    dueDate: t("tasks:sort.fields.dueDate"),
    title: t("tasks:sort.fields.title"),
    number: t("tasks:sort.fields.number"),
  };
}
