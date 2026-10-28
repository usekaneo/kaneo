import { SquareCheck } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getTaskItemStats } from "@/lib/get-task-item-stats";
import type Task from "@/types/task";
import { taskChipClass } from "./task-chip-class";

type ChecklistChipProps = {
  task: Task;
  className?: string;
};

export function ChecklistChip({ task, className }: ChecklistChipProps) {
  const { t } = useTranslation();
  const stats = useMemo(
    () =>
      task.descriptionDeferred ? null : getTaskItemStats(task.description),
    [task.description, task.descriptionDeferred],
  );
  if (!stats?.total) return null;

  const label = t("tasks:checklistProgress", {
    completed: stats.completed,
    total: stats.total,
  });

  return (
    <span
      title={label}
      className={cn(
        taskChipClass,
        "cursor-default tabular-nums hover:border-chip-border hover:bg-transparent",
        className,
      )}
    >
      <SquareCheck aria-hidden="true" className="text-chip-icon" />
      <span className="sr-only">{label}</span>
      <span aria-hidden="true">
        {stats.completed}/{stats.total}
      </span>
    </span>
  );
}
