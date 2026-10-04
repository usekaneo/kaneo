import { Repeat, X } from "lucide-react";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/cn";
import { defaultRecurrence } from "@/lib/default-recurrence";
import { upcomingOccurrences } from "@/lib/next-occurrence-date";
import type { TaskRecurrence } from "@/types/task/recurrence";
import TaskRecurrenceSettings from "./task-recurrence-settings";

type TaskDueDatePickerProps = {
  dueDate: Date | undefined;
  startDate?: Date;
  recurrence: TaskRecurrence | null;
  onDateChange: (date: Date | undefined) => void;
  onRecurrenceChange: (recurrence: TaskRecurrence | null) => void;
  onClear: () => void;
};

// Shared by an existing task's due date popover and the create task modal.
export default function TaskDueDatePicker({
  dueDate,
  startDate,
  recurrence,
  onDateChange,
  onRecurrenceChange,
  onClear,
}: TaskDueDatePickerProps) {
  const { t } = useTranslation();
  const upcoming = useMemo(
    () =>
      dueDate && recurrence ? upcomingOccurrences(dueDate, recurrence, 8) : [],
    [dueDate, recurrence],
  );

  return (
    <>
      <Calendar
        mode="single"
        selected={dueDate}
        defaultMonth={dueDate}
        onSelect={onDateChange}
        disabled={startDate ? { before: startDate } : undefined}
        modifiers={{ repeats: upcoming }}
        modifiersClassNames={{
          repeats:
            "[&>button]:bg-primary/12 [&>button]:font-medium [&>button]:text-primary",
        }}
        className="w-full bg-popover"
      />
      {recurrence && (
        <TaskRecurrenceSettings
          recurrence={recurrence}
          defaultWeekday={(dueDate ?? new Date()).getDay()}
          onChange={onRecurrenceChange}
        />
      )}
      <div className="flex items-center justify-between border-t border-border p-1.5">
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
            onRecurrenceChange(recurrence ? null : defaultRecurrence(dueDate))
          }
        >
          <Repeat className="h-4 w-4" />
          {t("tasks:popover.recurrence.toggle")}
        </Button>
        {dueDate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2 text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            <X className="h-4 w-4" />
            {t("tasks:popover.dueDate.clear")}
          </Button>
        )}
      </div>
    </>
  );
}
