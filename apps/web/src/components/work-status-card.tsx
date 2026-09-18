import { Link } from "@tanstack/react-router";
import { Pause, Play, Square, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  useClockIn,
  useClockOut,
} from "@/hooks/mutations/attendance/use-attendance-mutations";
import useCreateTimeEntry from "@/hooks/mutations/time-entry/use-create-time-entry";
import useStopTimeEntry from "@/hooks/mutations/time-entry/use-stop-time-entry";
import { useAttendanceStatus } from "@/hooks/queries/attendance/use-attendance";
import useCompanySettings from "@/hooks/queries/company/use-company-settings";
import useRunningTimeEntry from "@/hooks/queries/time-entry/use-running-time-entry";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useNow } from "@/hooks/use-now";
import { formatClock, formatHours } from "@/lib/format-duration";
import { toast } from "@/lib/toast";
import { zonedClock } from "@/lib/zoned-time";

type PausedTimer = { taskId: string; taskTitle: string; projectId: string };

// A paused timer is a stopped entry the person means to continue; the task
// to resume is remembered per workspace in this browser only.
function usePausedTimer(workspaceId: string | undefined) {
  const key = `kaneo:paused-timer:${workspaceId}`;
  const read = useCallback((): PausedTimer | null => {
    try {
      const raw = workspaceId ? localStorage.getItem(key) : null;
      return raw ? (JSON.parse(raw) as PausedTimer) : null;
    } catch {
      return null;
    }
  }, [key, workspaceId]);
  const [paused, setPausedState] = useState<PausedTimer | null>(read);
  useEffect(() => setPausedState(read()), [read]);

  const setPaused = (value: PausedTimer | null) => {
    setPausedState(value);
    try {
      if (value) localStorage.setItem(key, JSON.stringify(value));
      else localStorage.removeItem(key);
    } catch {}
  };

  return [paused, setPaused] as const;
}

// Always visible in the sidebar: am I clocked in, and what am I working on.
export function WorkStatusCard() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const workspaceId = workspace?.id;
  const { data: status, dataUpdatedAt } = useAttendanceStatus(workspaceId);
  const { data: running } = useRunningTimeEntry(workspaceId);
  const { data: company } = useCompanySettings(workspaceId);
  const timeZone = company?.timezone ?? "UTC";
  const [paused, setPaused] = usePausedTimer(workspaceId);
  const clockIn = useClockIn(workspaceId ?? "");
  const clockOut = useClockOut(workspaceId ?? "");
  const stopEntry = useStopTimeEntry();
  const startEntry = useCreateTimeEntry();
  const now = useNow(Boolean(status?.clockedIn || running));

  if (!workspaceId || !status) return null;

  const fail = (error: unknown, fallback: string) =>
    toast.error(error instanceof Error ? error.message : fallback);

  // The server's figure is as of the fetch; keep it ticking locally.
  const worked =
    status.today.workedMinutes * 60 +
    (status.clockedIn
      ? Math.max(0, Math.floor((now.getTime() - dataUpdatedAt) / 1000))
      : 0);

  const elapsed = running
    ? Math.floor((now.getTime() - new Date(running.startTime).getTime()) / 1000)
    : 0;

  const pause = async () => {
    if (!running) return;
    try {
      await stopEntry.mutateAsync(running.id);
      setPaused({
        taskId: running.taskId,
        taskTitle: running.taskTitle,
        projectId: running.projectId,
      });
    } catch (error) {
      fail(error, t("time:task.stopError"));
    }
  };

  const stop = async () => {
    if (!running) return;
    try {
      await stopEntry.mutateAsync(running.id);
      setPaused(null);
    } catch (error) {
      fail(error, t("time:task.stopError"));
    }
  };

  const resume = async () => {
    if (!paused) return;
    try {
      await startEntry.mutateAsync({
        taskId: paused.taskId,
        startTime: new Date().toISOString(),
      });
      setPaused(null);
    } catch (error) {
      fail(error, t("time:task.startError"));
    }
  };

  return (
    <div className="space-y-2 rounded-md border border-border bg-background p-2 text-xs">
      <div className="flex items-center gap-2">
        <span
          className={
            status.clockedIn
              ? "size-2 shrink-0 rounded-full bg-emerald-500"
              : status.today.status === "leave"
                ? "size-2 shrink-0 rounded-full bg-sky-500"
                : "size-2 shrink-0 rounded-full bg-muted-foreground/40"
          }
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1 truncate">
          {status.clockedIn && status.since ? (
            <>
              <span className="text-foreground">
                {t("attendance:card.since", {
                  time: zonedClock(status.since, timeZone),
                })}
              </span>
              <span className="text-muted-foreground tabular-nums">
                {" · "}
                {formatHours(worked)}
              </span>
            </>
          ) : status.today.status === "leave" ? (
            <span className="text-sky-700 dark:text-sky-300">
              {t("attendance:status.leave")}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {t("attendance:card.notClockedIn")}
            </span>
          )}
        </span>
        {status.today.status === "leave" &&
        !status.clockedIn ? null : status.clockedIn ? (
          <Button
            variant="outline"
            size="xs"
            disabled={clockOut.isPending}
            onClick={() =>
              clockOut
                .mutateAsync()
                .catch((e) => fail(e, t("attendance:card.error")))
            }
          >
            {t("attendance:card.clockOut")}
          </Button>
        ) : (
          <Button
            size="xs"
            disabled={clockIn.isPending}
            onClick={() =>
              clockIn
                .mutateAsync()
                .catch((e) => fail(e, t("attendance:card.error")))
            }
          >
            {t("attendance:card.clockIn")}
          </Button>
        )}
      </div>

      {running ? (
        <div className="flex items-center gap-2 border-t border-border pt-2">
          <Link
            to="/dashboard/workspace/$workspaceId/project/$projectId/task/$taskId"
            params={{
              workspaceId,
              projectId: running.projectId,
              taskId: running.taskId,
            }}
            className="min-w-0 flex-1 hover:underline"
          >
            <span className="block truncate font-medium text-foreground">
              {running.taskTitle}
            </span>
            <span className="block tabular-nums text-muted-foreground">
              {formatClock(elapsed)}
            </span>
          </Link>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={pause}
            disabled={stopEntry.isPending}
            aria-label={t("attendance:card.pause")}
          >
            <Pause className="size-3" />
          </Button>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={stop}
            disabled={stopEntry.isPending}
            aria-label={t("time:task.stop")}
          >
            <Square className="size-3 fill-current" />
          </Button>
        </div>
      ) : paused ? (
        <div className="flex items-center gap-2 border-t border-border pt-2">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-foreground">
              {paused.taskTitle}
            </span>
            <span className="block text-muted-foreground">
              {t("attendance:card.paused")}
            </span>
          </span>
          <Button
            variant="outline"
            size="icon-xs"
            onClick={resume}
            disabled={startEntry.isPending}
            aria-label={t("attendance:card.resume")}
          >
            <Play className="size-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={() => setPaused(null)}
            aria-label={t("attendance:card.dismiss")}
          >
            <X className="size-3" />
          </Button>
        </div>
      ) : null}
    </div>
  );
}
