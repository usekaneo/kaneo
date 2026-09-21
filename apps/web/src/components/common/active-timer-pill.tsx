import { useNavigate } from "@tanstack/react-router";
import { Pause, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import useStopTimeEntry from "@/hooks/mutations/time-entry/use-stop-time-entry";
import useGetRunningTimeEntry from "@/hooks/queries/time-entry/use-get-running-time-entry";
import { useElapsed } from "@/hooks/use-elapsed";
import { formatDurationExact } from "@/lib/format";
import { toast } from "@/lib/toast";

export default function ActiveTimerPill() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: running } = useGetRunningTimeEntry();

  const elapsed = useElapsed(running?.startTime ?? null);
  const { mutateAsync: stopTimeEntry, isPending } = useStopTimeEntry(
    running?.taskId ?? "",
  );

  if (!running) {
    return null;
  }

  const handleStop = async () => {
    try {
      await stopTimeEntry();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:timeTracking.stopError"),
      );
    }
  };

  const handleOpenTask = () => {
    navigate({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId",
      params: {
        workspaceId: running.workspaceId,
        projectId: running.projectId,
        taskId: running.taskId,
      },
    });
  };

  return (
    <div className="flex shrink-0 items-center gap-1 rounded-md border border-border/80 bg-background px-1.5 py-0.5">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={handleOpenTask}
              className="flex min-w-0 cursor-pointer items-center gap-1.5 rounded px-1 py-0.5 text-left transition-colors hover:bg-accent/60"
            >
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <Timer className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="max-w-24 truncate text-xs font-medium text-foreground hover:text-primary hover:underline">
                {running.taskTitle ?? t("tasks:common.selectTask")}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {formatDurationExact(elapsed)}
              </span>
            </button>
          </TooltipTrigger>
          <TooltipContent>
            {running.taskTitle ?? t("tasks:common.selectTask")}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      {/*
        Deliberately ungated: this pill is cross-workspace (the running timer
        may live elsewhere), so no single-workspace permission answer is
        valid here. The API enforces task:update and the toast explains a
        rejection, which only the demoted-mid-timer edge can ever trigger.
      */}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-6 shrink-0 p-0"
        disabled={isPending}
        onClick={() => void handleStop()}
        aria-label={t("tasks:timeTracking.stop")}
      >
        <Pause className="size-3.5" />
      </Button>
    </div>
  );
}
