import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskProgressPopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskProgressPopover({
  task,
  children,
}: TaskProgressPopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [localProgress, setLocalProgress] = useState(task.progress ?? 0);
  const { mutateAsync: updateTask } = useUpdateTask();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const handleCommit = async (value: number) => {
    if (value === (task.progress ?? 0)) return;
    try {
      await updateTask({ ...task, progress: value });
    } catch (error) {
      setLocalProgress(task.progress ?? 0);
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.progress.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setLocalProgress(task.progress ?? 0);
      }}
    >
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-56 p-3" align="start">
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t("tasks:popover.progress.percentLabel")}
            </span>
            <span className="text-sm font-semibold tabular-nums">
              {localProgress}%
            </span>
          </div>
          <Slider
            value={localProgress}
            min={0}
            max={100}
            step={5}
            aria-label={t("tasks:popover.progress.percentLabel")}
            onValueChange={(value) =>
              setLocalProgress(Array.isArray(value) ? value[0] : value)
            }
            onValueCommitted={(value) =>
              handleCommit(Array.isArray(value) ? value[0] : value)
            }
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}
