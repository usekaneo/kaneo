import { format } from "date-fns";
import { Play, Square, Trash2 } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Popover, PopoverPopup, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import useCreateTimeEntry from "@/hooks/mutations/time-entry/use-create-time-entry";
import useDeleteTimeEntry from "@/hooks/mutations/time-entry/use-delete-time-entry";
import useStopTimeEntry from "@/hooks/mutations/time-entry/use-stop-time-entry";
import useGetTimeEntriesByTaskId from "@/hooks/queries/time-entry/use-get-time-entries";
import { useNow } from "@/hooks/use-now";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatClock, formatHours } from "@/lib/format-duration";
import { toast } from "@/lib/toast";

type Entry = {
  startTime: string;
  endTime: string | null;
  duration: number | null;
};

function secondsOf(entry: Entry, now: Date) {
  if (entry.endTime && entry.duration !== null) return entry.duration;
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(entry.startTime).getTime()) / 1000),
  );
}

/** The task's time entries, your running timer, and the actions on them. */
function useTaskTime(taskId: string) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: entries = [] } = useGetTimeEntriesByTaskId(taskId);
  const create = useCreateTimeEntry();
  const stopEntry = useStopTimeEntry();
  const deleteEntry = useDeleteTimeEntry();
  const { canUpdateTasks, canManageEveryonesTime } = useWorkspacePermission();

  const mine = entries.find((e) => !e.endTime && e.userId === user?.id);
  const now = useNow(entries.some((e) => !e.endTime));
  const total = entries.reduce((sum, e) => sum + secondsOf(e, now), 0);

  const fail = (fallback: string) => (error: unknown) =>
    toast.error(error instanceof Error ? error.message : t(fallback));

  return {
    entries,
    mine,
    now,
    total,
    userId: user?.id,
    canTrack: Boolean(canUpdateTasks()),
    canManageAll: Boolean(canManageEveryonesTime()),
    starting: create.isPending,
    stopping: stopEntry.isPending,
    start: () =>
      create
        .mutateAsync({ taskId, startTime: new Date().toISOString() })
        .catch(fail("time:task.startError")),
    stop: (description?: string) =>
      mine
        ? stopEntry
            .mutateAsync({ id: mine.id, description })
            .catch(fail("time:task.stopError"))
        : undefined,
    remove: (id: string) =>
      deleteEntry
        .mutateAsync(id)
        .then(() => toast.success(t("time:task.deleted")))
        .catch(fail("time:task.deleteError")),
  };
}

/**
 * Start or stop your timer on this task; sits at the top of the task.
 * Stopping asks what was done, so the log reads as a record of the work.
 */
export function TaskTimerButton({ taskId }: { taskId: string }) {
  const { t } = useTranslation();
  const time = useTaskTime(taskId);
  const [asking, setAsking] = useState(false);
  const [note, setNote] = useState("");
  if (!time.canTrack) return null;

  if (time.mine) {
    const finish = async (withNote: boolean) => {
      await time.stop(withNote ? note : undefined);
      setNote("");
      setAsking(false);
    };
    return (
      <Popover open={asking} onOpenChange={setAsking}>
        <PopoverTrigger
          render={
            <Button
              size="sm"
              variant="outline"
              disabled={time.stopping}
              aria-label={t("time:task.stop")}
              className="gap-2 rounded-full border-emerald-500/40 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/15 dark:text-emerald-400"
            >
              <span className="relative flex size-2">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-500 opacity-60" />
                <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
              </span>
              <span className="font-semibold tabular-nums">
                {formatClock(secondsOf(time.mine, time.now))}
              </span>
              <Square className="size-3 fill-current" />
            </Button>
          }
        />
        <PopoverPopup align="end" className="w-80">
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              void finish(true);
            }}
          >
            <div className="space-y-1">
              <p className="text-sm font-semibold">
                {t("time:task.whatDidYouDo")}
              </p>
              <p className="text-xs text-muted-foreground">
                {t("time:task.whatDidYouDoHint", {
                  time: formatHours(secondsOf(time.mine, time.now)),
                })}
              </p>
            </div>
            <Textarea
              autoFocus
              rows={3}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t("time:task.whatDidYouDoPlaceholder")}
              aria-label={t("time:task.whatDidYouDo")}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void finish(true);
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                size="xs"
                disabled={time.stopping}
                onClick={() => void finish(false)}
              >
                {t("time:task.stopWithoutNote")}
              </Button>
              <Button type="submit" size="xs" disabled={time.stopping}>
                <Square className="size-3 fill-current" />
                {t("time:task.stopAndSave")}
              </Button>
            </div>
          </form>
        </PopoverPopup>
      </Popover>
    );
  }
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => void time.start()}
      disabled={time.starting}
      className="gap-1.5 rounded-full"
    >
      <Play className="size-3.5 fill-current" />
      {t("time:task.start")}
    </Button>
  );
}

/** Total and every entry on the task, newest first, with what was done. */
export function TaskTimeLog({
  taskId,
  className,
}: {
  taskId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const time = useTaskTime(taskId);

  return (
    <section className={cn("flex flex-col gap-1.5", className)}>
      <div className="flex items-center gap-2 px-2">
        <span className="flex-1 text-xs font-medium text-foreground/70">
          {t("time:task.title")}
        </span>
        {time.total > 0 && (
          <span className="text-xs font-semibold tabular-nums">
            {formatHours(time.total)}
          </span>
        )}
      </div>

      {time.entries.length === 0 ? (
        <p className="px-2 text-xs text-muted-foreground">
          {t("time:task.empty")}
        </p>
      ) : (
        <ul className="flex flex-col">
          {[...time.entries].reverse().map((entry) => {
            const canRemove =
              (entry.userId !== null && entry.userId === time.userId) ||
              time.canManageAll;
            const running = !entry.endTime;
            const start = new Date(entry.startTime);
            return (
              <li
                key={entry.id}
                className="group flex items-start gap-2 rounded-md px-2 py-1.5 hover:bg-accent/50"
              >
                <span
                  className={cn(
                    "mt-1.5 size-1.5 shrink-0 rounded-full",
                    running ? "bg-emerald-500" : "bg-muted-foreground/40",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xs font-medium">
                    {entry.userName ?? t("time:task.formerMember")}
                  </span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {format(start, "MMM d, HH:mm")}
                    {running
                      ? ` · ${t("time:task.running")}`
                      : `–${format(new Date(entry.endTime as string), "HH:mm")}`}
                  </span>
                  {entry.description && (
                    <span className="mt-0.5 line-clamp-2 block text-[11px] text-foreground/80">
                      {entry.description}
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                  {formatHours(secondsOf(entry, time.now))}
                </span>
                {canRemove && (
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className="-my-0.5 text-muted-foreground opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                    aria-label={t("time:task.delete")}
                    onClick={() => void time.remove(entry.id)}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
