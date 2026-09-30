import { Timer } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskTimeEstimate } from "@/hooks/mutations/task/use-update-task-time-estimate";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatTimeEstimate, parseTimeEstimate } from "@/lib/time-estimate";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type TaskTimeEstimatePopoverProps = {
  task: Task;
  children: React.ReactNode;
};

export default function TaskTimeEstimatePopover({
  task,
  children,
}: TaskTimeEstimatePopoverProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { mutateAsync: updateTaskTimeEstimate, isPending } =
    useUpdateTaskTimeEstimate();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setValue(
        task.timeEstimate != null ? formatTimeEstimate(task.timeEstimate) : "",
      );
      setError(null);
    }
    setOpen(nextOpen);
  };

  const handleSave = async () => {
    const trimmed = value.trim();
    // Empty or zero clears a previously set estimate.
    const seconds = trimmed ? parseTimeEstimate(trimmed) : null;
    if (trimmed && seconds == null) {
      setError(t("tasks:popover.timeEstimate.invalid"));
      return;
    }
    try {
      const next = seconds && seconds > 0 ? seconds : null;
      await updateTaskTimeEstimate({
        ...task,
        timeEstimate: next,
      });
      setValue(next != null ? formatTimeEstimate(next) : "");
      toast.success(t("tasks:popover.timeEstimate.updateSuccess"));
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:popover.timeEstimate.updateError"),
      );
    }
  };

  if (!canEdit) return <>{children}</>;

  const trimmedValue = value.trim();
  const parsedValue = trimmedValue ? parseTimeEstimate(trimmedValue) : null;
  // Saving empty/zero with no existing estimate changes nothing.
  const isNoopSave =
    (trimmedValue === "" || parsedValue === 0) && task.timeEstimate == null;

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent className="w-64 p-3" align="start">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Timer className="h-4 w-4 text-muted-foreground" />
            {t("tasks:popover.timeEstimate.title")}
          </div>
          <Input
            autoFocus
            autoComplete="off"
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleSave();
            }}
            placeholder={t("tasks:popover.timeEstimate.placeholder")}
            inputMode="text"
            aria-invalid={error ? true : undefined}
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
          <Button
            size="sm"
            className="w-full"
            disabled={isPending || isNoopSave}
            onClick={() => void handleSave()}
          >
            {t("tasks:popover.timeEstimate.save")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
