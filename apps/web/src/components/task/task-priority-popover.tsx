import { useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionMenu } from "@/components/common/option-menu/option-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskPriority } from "@/hooks/mutations/task/use-update-task-status-priority";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getPriorityLabel } from "@/lib/i18n/domain";
import { getPriorityIcon } from "@/lib/priority";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskPriorityPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

const priorities = ["no-priority", "low", "medium", "high", "urgent"];

export default function TaskPriorityPopover({
  task,
  children,
}: TaskPriorityPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTaskPriority } = useUpdateTaskPriority();
  const { canUpdateTasks } = useWorkspacePermission();

  if (!canUpdateTasks()) return <>{children}</>;

  const changePriority = async (priority: string) => {
    setOpen(false);
    try {
      await updateTaskPriority({ ...task, priority });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.priority.updateError"),
      );
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-60 p-0" align="start">
        <OptionMenu
          label={t("tasks:priority.label")}
          placeholder={t("tasks:bulk.priorityPlaceholder")}
          options={priorities.map((priority) => ({
            value: priority,
            label: getPriorityLabel(priority),
            icon: getPriorityIcon(priority),
            selected: (task.priority || "no-priority") === priority,
          }))}
          onSelect={changePriority}
        />
      </PopoverContent>
    </Popover>
  );
}
