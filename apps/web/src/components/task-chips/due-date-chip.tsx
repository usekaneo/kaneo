import { Calendar } from "lucide-react";
import { useTranslation } from "react-i18next";
import TaskDueDatePopover from "@/components/task/task-due-date-popover";
import { cn } from "@/lib/cn";
import { formatDateMedium } from "@/lib/format";
import { getRelativeDueDate } from "@/lib/relative-due-date";
import type Task from "@/types/task";
import { formatRelativeDueDate } from "./format-relative-due-date";
import { stopCardEvents } from "./stop-card-events";
import { taskChipClass } from "./task-chip-class";

type DueDateChipProps = {
  task: Task;
  isCompleted?: boolean;
};

export function DueDateChip({ task, isCompleted = false }: DueDateChipProps) {
  const { t } = useTranslation();
  if (!task.dueDate) return null;

  const relative = getRelativeDueDate(task.dueDate);
  const overdue = relative.kind === "overdue" && !isCompleted;

  return (
    <TaskDueDatePopover task={task}>
      <button
        type="button"
        title={t("tasks:due.fullDate", {
          date: formatDateMedium(task.dueDate),
        })}
        className={cn(taskChipClass, overdue && "font-medium text-due-overdue")}
        {...stopCardEvents}
      >
        <Calendar className={cn(!overdue && "text-chip-icon")} />
        {formatRelativeDueDate(relative, task.dueDate, t)}
      </button>
    </TaskDueDatePopover>
  );
}
