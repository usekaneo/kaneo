import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  useClearTaskBaseline,
  useSetTaskBaseline,
} from "@/hooks/mutations/task/use-set-task-baseline";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatDateShort } from "@/lib/format";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskBaselinePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskBaselinePopover({
  task,
  children,
}: TaskBaselinePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const { mutateAsync: setBaseline, isPending: isSetting } =
    useSetTaskBaseline();
  const { mutateAsync: clearBaseline, isPending: isClearing } =
    useClearTaskBaseline();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const hasBaseline = Boolean(task.baselineStartDate || task.baselineDueDate);

  const handleSet = async () => {
    try {
      await setBaseline(task);
      toast.success(t("tasks:popover.baseline.setSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.baseline.setError"),
      );
    }
  };

  const handleClear = async () => {
    try {
      await clearBaseline(task);
      toast.success(t("tasks:popover.baseline.clearSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.baseline.clearError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium text-foreground">
            {t("tasks:popover.baseline.label")}
          </span>
          <span className="text-xs text-muted-foreground">
            {hasBaseline
              ? t("tasks:popover.baseline.range", {
                  start: task.baselineStartDate
                    ? formatDateShort(task.baselineStartDate)
                    : "—",
                  end: task.baselineDueDate
                    ? formatDateShort(task.baselineDueDate)
                    : "—",
                })
              : t("tasks:popover.baseline.none")}
          </span>
          <div className="mt-1 flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              disabled={isSetting}
              onClick={handleSet}
            >
              {t("tasks:popover.baseline.set")}
            </Button>
            {hasBaseline && (
              <Button
                variant="ghost"
                size="sm"
                className="flex-1 text-muted-foreground hover:text-destructive"
                disabled={isClearing}
                onClick={handleClear}
              >
                {t("tasks:popover.baseline.clear")}
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
