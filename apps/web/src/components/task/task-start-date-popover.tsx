import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DatePickerMenu } from "@/components/common/date-picker/date-picker-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskStartDatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskStartDatePopover({
  task,
  children,
}: TaskStartDatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const handleDateChange = async (date: Date | null) => {
    try {
      await updateTask({
        ...task,
        startDate: date?.toISOString() ?? null,
      });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.startDate.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-65 p-0" align="start">
        <DatePickerMenu
          label={t("tasks:properties.startDate")}
          placeholder={t("tasks:datePicker.startDatePlaceholder")}
          clearLabel={t("tasks:popover.startDate.clear")}
          value={task.startDate ? new Date(task.startDate) : null}
          onChange={handleDateChange}
          bounds={task.dueDate ? { after: new Date(task.dueDate) } : undefined}
          formatLimit={(date) => t("tasks:due.fullDate", { date })}
        />
      </PopoverContent>
    </Popover>
  );
}
