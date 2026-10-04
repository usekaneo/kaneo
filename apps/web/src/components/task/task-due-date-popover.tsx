import { Repeat, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import { useUpdateTaskRecurrence } from "@/hooks/mutations/task/use-update-task-recurrence";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { upcomingOccurrences } from "@/lib/next-occurrence-date";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import type { TaskRecurrence } from "@/types/task/recurrence";
import TaskRecurrenceSettings from "./task-recurrence-settings";

type TaskDueDatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskDueDatePopover({
  task,
  children,
}: TaskDueDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskDueDate } = useUpdateTaskDueDate();
  const { mutateAsync: updateTaskRecurrence } = useUpdateTaskRecurrence();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const recurrence = task.recurrence ?? null;
  const dueDate = useMemo(
    () => (task.dueDate ? new Date(task.dueDate) : undefined),
    [task.dueDate],
  );
  const upcoming = useMemo(
    () =>
      dueDate && recurrence ? upcomingOccurrences(dueDate, recurrence, 8) : [],
    [dueDate, recurrence],
  );

  const handleDateChange = async (date: Date | undefined) => {
    try {
      await updateTaskDueDate({
        ...task,
        dueDate: date?.toISOString() || null,
      });
      toast.success(t("tasks:popover.dueDate.updateSuccess"));
      // Keep a repeating task's picker open to show its upcoming dates.
      if (!recurrence) setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.dueDate.updateError"),
      );
    }
  };

  const handleRecurrenceChange = async (next: TaskRecurrence | null) => {
    try {
      await updateTaskRecurrence({ task, recurrence: next });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.recurrence.updateError"),
      );
    }
  };

  const toggleRepeat = () =>
    handleRecurrenceChange(
      recurrence
        ? null
        : {
            frequency: "weekly",
            interval: 1,
            weekdays: [(dueDate ?? new Date()).getDay()],
            // Keeps the next due date on the same local day across DST changes.
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
          },
    );

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Calendar
          mode="single"
          selected={dueDate}
          defaultMonth={dueDate}
          onSelect={handleDateChange}
          disabled={
            task.startDate ? { before: new Date(task.startDate) } : undefined
          }
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
            onChange={handleRecurrenceChange}
          />
        )}
        <div className="flex items-center justify-between border-t border-border p-1.5">
          <Button
            variant="ghost"
            size="sm"
            aria-pressed={Boolean(recurrence)}
            className={cn(
              "gap-2 text-muted-foreground hover:text-foreground",
              recurrence && "bg-accent text-foreground",
            )}
            onClick={toggleRepeat}
          >
            <Repeat className="h-4 w-4" />
            {t("tasks:popover.recurrence.toggle")}
          </Button>
          {task.dueDate && (
            <Button
              variant="ghost"
              size="sm"
              className="gap-2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setOpen(false);
                void handleDateChange(undefined);
              }}
            >
              <X className="h-4 w-4" />
              {t("tasks:popover.dueDate.clear")}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
