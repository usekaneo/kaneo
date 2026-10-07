import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskDueDate } from "@/hooks/mutations/task/use-update-task-due-date";
import { useUpdateTaskRecurrence } from "@/hooks/mutations/task/use-update-task-recurrence";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import type { TaskRecurrence } from "@/types/task/recurrence";
import TaskDueDatePicker from "./task-due-date-picker";

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
  const startDate = useMemo(
    () => (task.startDate ? new Date(task.startDate) : undefined),
    [task.startDate],
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

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <TaskDueDatePicker
          dueDate={dueDate}
          startDate={startDate}
          recurrence={recurrence}
          onDateChange={handleDateChange}
          onRecurrenceChange={handleRecurrenceChange}
          onClear={() => {
            setOpen(false);
            void handleDateChange(undefined);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
