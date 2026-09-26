import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskMilestonePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskMilestonePopover({
  task,
  children,
}: TaskMilestonePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const handleToggle = async (checked: boolean) => {
    try {
      await updateTask({ ...task, isMilestone: checked });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.milestone.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              {t("tasks:popover.milestone.label")}
            </span>
            <span className="text-xs text-muted-foreground">
              {t("tasks:popover.milestone.description")}
            </span>
          </div>
          <Switch
            checked={task.isMilestone ?? false}
            onCheckedChange={handleToggle}
            aria-label={t("tasks:popover.milestone.label")}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
