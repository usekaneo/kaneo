import { useTranslation } from "react-i18next";

export function TaskCount({ shown, total }: { shown: number; total: number }) {
  const { t } = useTranslation();

  return (
    <span className="hidden truncate text-xs text-muted-foreground tabular-nums sm:inline">
      {shown === total
        ? t("tasks:toolbar.taskCount", { count: total })
        : t("tasks:toolbar.shownCount", { shown, count: total })}
    </span>
  );
}
