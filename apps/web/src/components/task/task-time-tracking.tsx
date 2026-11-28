import { ChevronDown, ChevronRight, Loader2, Play, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import useCreateTimeEntry from "@/hooks/mutations/time-entry/use-create-time-entry";
import useUpdateTimeEntry from "@/hooks/mutations/time-entry/use-update-time-entry";
import useGetTimeEntriesByTaskId from "@/hooks/queries/time-entry/use-get-time-entries";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

import formatDuration from "./format-tracked-duration";

type TaskTimeTrackingProps = {
  taskId: string;
};

export function TaskTimeTracking({ taskId }: TaskTimeTrackingProps) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();
  const [isOpen, setIsOpen] = useState(false);

  const { data, isLoading, isFetching, isError, refetch } =
    useGetTimeEntriesByTaskId(taskId);
  const { mutateAsync: createEntry, isPending: isStarting } =
    useCreateTimeEntry();
  const { mutateAsync: updateEntry, isPending: isStopping } =
    useUpdateTimeEntry(taskId);

  const entries = useMemo(
    () =>
      [...(data ?? [])].sort(
        (a, b) => Date.parse(b.startTime) - Date.parse(a.startTime),
      ),
    [data],
  );

  const hasRunningEntry = entries.some((entry) => entry.endTime === null);
  const myRunningEntry = entries.find(
    (entry) => entry.endTime === null && entry.userId === user?.id,
  );

  // Only tick a clock while something is running, so a task with no open timer
  // does not schedule a needless interval.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!hasRunningEntry) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [hasRunningEntry]);

  const elapsedSeconds = (entry: (typeof entries)[number]) =>
    Math.max(
      0,
      entry.endTime === null
        ? Math.floor((now - Date.parse(entry.startTime)) / 1000)
        : (entry.duration ??
            Math.floor(
              (Date.parse(entry.endTime) - Date.parse(entry.startTime)) / 1000,
            )),
    );

  const totalSeconds = entries.reduce(
    (sum, entry) => sum + elapsedSeconds(entry),
    0,
  );

  const handleStart = async () => {
    try {
      await createEntry({ taskId, startTime: new Date().toISOString() });
    } catch {
      toast.error(t("tasks:timeTracking.startError"));
    }
  };

  const handleStop = async () => {
    if (!myRunningEntry) return;
    try {
      await updateEntry({
        id: myRunningEntry.id,
        startTime: myRunningEntry.startTime,
        endTime: new Date().toISOString(),
      });
    } catch {
      toast.error(t("tasks:timeTracking.stopError"));
    }
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="w-full">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <CollapsibleTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {isOpen ? (
                <ChevronDown className="size-4" />
              ) : (
                <ChevronRight className="size-4" />
              )}
              <span>{t("tasks:timeTracking.title")}</span>
            </button>
          </CollapsibleTrigger>
          {totalSeconds > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatDuration(totalSeconds, t)}
            </span>
          )}
        </div>
        {canEdit &&
          (myRunningEntry ? (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground gap-1"
              onClick={handleStop}
              disabled={isStarting || isStopping || isLoading || isError}
            >
              {isStopping ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Square className="size-3.5" />
              )}
              {t("tasks:timeTracking.stop")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground gap-1"
              onClick={handleStart}
              disabled={
                isStarting || isStopping || isLoading || isFetching || isError
              }
            >
              {isStarting ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Play className="size-3.5" />
              )}
              {t("tasks:timeTracking.start")}
            </Button>
          ))}
      </div>

      <CollapsibleContent>
        {isError ? (
          <div role="alert" className="mt-2 text-sm text-destructive">
            {t("tasks:timeTracking.loadError")}
            <Button variant="ghost" size="xs" onClick={() => void refetch()}>
              {t("tasks:timeTracking.retry")}
            </Button>
          </div>
        ) : isLoading ? (
          <div className="flex justify-center py-3">
            <Loader2 className="size-4 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <p className="mt-1.5 px-2 text-xs text-muted-foreground">
            {t("tasks:timeTracking.empty")}
          </p>
        ) : (
          <div className="mt-1.5 flex flex-col">
            {entries.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between px-2 py-1 text-sm"
              >
                <div className="flex min-w-0 flex-col">
                  <span className="truncate text-muted-foreground">
                    {entry.userName ?? t("tasks:timeTracking.unknownUser")}
                  </span>
                  {entry.description && (
                    <span className="truncate text-xs text-muted-foreground/70">
                      {entry.description}
                    </span>
                  )}
                </div>
                <span className="shrink-0 tabular-nums text-muted-foreground">
                  {entry.endTime === null ? (
                    <span className="text-primary">
                      {t("tasks:timeTracking.running")}{" "}
                      {formatDuration(elapsedSeconds(entry), t)}
                    </span>
                  ) : (
                    formatDuration(elapsedSeconds(entry), t)
                  )}
                </span>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
