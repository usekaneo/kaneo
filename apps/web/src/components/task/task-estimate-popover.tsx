import { Timer, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useUpdateTaskEstimate } from "@/hooks/mutations/task/use-update-task-estimate";
import useGetTimeEntriesByTaskId from "@/hooks/queries/time-entry/use-get-time-entries";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatHours, parseDurationInput } from "@/lib/format-duration";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";

type Props = {
  task: Task;
};

// "Estimated 3h · Tracked 2h 17m" in one small property button.
export default function TaskEstimatePopover({ task }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const { mutateAsync: updateEstimate, isPending } = useUpdateTaskEstimate();
  const { data: entries = [] } = useGetTimeEntriesByTaskId(task.id);
  const { canUpdateTasks } = useWorkspacePermission();

  const estimate = task.estimateMinutes ?? null;
  const tracked = entries.reduce((sum, e) => sum + (e.duration ?? 0), 0);
  const over = estimate !== null && tracked > estimate * 60;

  const label =
    estimate !== null && tracked > 0
      ? `${formatHours(tracked)} / ${formatHours(estimate * 60)}`
      : estimate !== null
        ? formatHours(estimate * 60)
        : tracked > 0
          ? formatHours(tracked)
          : t("tasks:estimate.add");

  const save = async (minutes: number | null) => {
    try {
      await updateEstimate({
        taskId: task.id,
        projectId: task.projectId,
        estimateMinutes: minutes,
      });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("tasks:estimate.error"),
      );
    }
  };

  const submit = () => {
    const minutes = parseDurationInput(value);
    if (minutes === null) {
      toast.error(t("tasks:estimate.invalid"));
      return;
    }
    void save(minutes);
  };

  const trigger = (
    <Button
      variant="ghost"
      size="sm"
      className="justify-start h-7 px-1.5 gap-1.5"
      title={t("tasks:estimate.tooltip")}
    >
      <Timer
        className={cn(
          "w-3.5 h-3.5",
          over ? "text-amber-500" : "text-muted-foreground",
        )}
      />
      <span
        className={cn(
          "text-xs font-semibold tabular-nums",
          estimate === null && tracked === 0 && "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </Button>
  );

  if (!canUpdateTasks()) return trigger;

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) setValue(estimate !== null ? formatHours(estimate * 60) : "");
      }}
    >
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent className="w-60 space-y-2 p-3" align="start">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={t("tasks:estimate.placeholder")}
            aria-label={t("tasks:estimate.label")}
          />
          <Button type="submit" size="sm" disabled={isPending}>
            {t("tasks:estimate.save")}
          </Button>
        </form>
        <p className="text-xs text-muted-foreground">
          {t("tasks:estimate.tracked", { time: formatHours(tracked) })}
        </p>
        {estimate !== null && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={() => save(null)}
          >
            <X className="h-4 w-4" />
            {t("tasks:estimate.clear")}
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}
