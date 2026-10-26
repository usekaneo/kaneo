import { Repeat } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DatePickerMenu } from "@/components/common/date-picker/date-picker-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { defaultRecurrence } from "@/lib/default-recurrence";
import { upcomingOccurrences } from "@/lib/next-occurrence-date";
import type { TaskRecurrence } from "@/types/task/recurrence";
import TaskRecurrenceSettings from "./task-recurrence-settings";

type TaskDueDatePickerProps = {
  label: string;
  clearLabel: string;
  dueDate: Date | null;
  startDate?: Date;
  recurrence: TaskRecurrence | null;
  onDateChange: (date: Date | null) => void;
  onRecurrenceChange: (recurrence: TaskRecurrence | null) => void;
  canSetRecurrence?: boolean;
};

// Shared by an existing task's due date popover and the create task modal.
export default function TaskDueDatePicker({
  label,
  clearLabel,
  dueDate,
  startDate,
  recurrence,
  onDateChange,
  onRecurrenceChange,
  canSetRecurrence = true,
}: TaskDueDatePickerProps) {
  const { t } = useTranslation();
  const upcoming = useMemo(
    () =>
      dueDate && recurrence ? upcomingOccurrences(dueDate, recurrence, 8) : [],
    [dueDate, recurrence],
  );

  return (
    <>
      <DatePickerMenu
        label={label}
        placeholder={t("tasks:datePicker.dueDatePlaceholder")}
        clearLabel={clearLabel}
        value={dueDate}
        onChange={onDateChange}
        bounds={startDate ? { before: startDate } : undefined}
        formatLimit={(date) => t("tasks:datePicker.startsOn", { date })}
        highlighted={upcoming}
      />
      {recurrence && canSetRecurrence && (
        <TaskRecurrenceSettings
          recurrence={recurrence}
          defaultWeekday={dueDate?.getDay()}
          onChange={onRecurrenceChange}
        />
      )}
      {(canSetRecurrence || recurrence) && (
        <div className="border-t border-border p-1.5">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            aria-pressed={Boolean(recurrence)}
            className={cn(
              "gap-2 text-muted-foreground hover:text-foreground",
              recurrence && "bg-accent text-foreground",
            )}
            onClick={() =>
              onRecurrenceChange(recurrence ? null : defaultRecurrence())
            }
          >
            <Repeat className="h-4 w-4" />
            {t("tasks:popover.recurrence.toggle")}
          </Button>
        </div>
      )}
    </>
  );
}
