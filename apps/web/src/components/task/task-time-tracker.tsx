import { Pause, Play, Timer } from "lucide-react";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import useCreateTimeEntry from "@/hooks/mutations/time-entry/use-create-time-entry";
import useDeleteTimeEntry from "@/hooks/mutations/time-entry/use-delete-time-entry";
import useStartTimeEntry from "@/hooks/mutations/time-entry/use-start-time-entry";
import useStopTimeEntry from "@/hooks/mutations/time-entry/use-stop-time-entry";
import useGetRunningTimeEntry from "@/hooks/queries/time-entry/use-get-running-time-entry";
import useGetTimeEntriesByTaskId from "@/hooks/queries/time-entry/use-get-time-entries";
import { useGetActiveWorkspaceUsers } from "@/hooks/queries/workspace-users/use-get-active-workspace-users";
import { useElapsed } from "@/hooks/use-elapsed";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";
import { formatDuration, formatDurationExact } from "@/lib/format";
import { getInitials } from "@/lib/get-initials";
import { toast } from "@/lib/toast";
import TimeEntryForm, { type TimeEntryFormValue } from "./time-entry-form";
import TimeEntryRow, {
  resolveEntryMember,
  type TimeEntryItem,
} from "./time-entry-row";

type TaskTimeTrackerProps = {
  taskId: string;
  taskTitle: string;
  workspaceId: string;
  compact?: boolean;
};

type TaskTimeTrackerContentProps = {
  taskId: string;
  taskTitle: string;
  workspaceId: string;
  onManualSaved?: () => void;
};

function useTaskTimeView(taskId: string, workspaceId: string) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { canUpdateTasks } = useWorkspacePermission();
  const canEdit = canUpdateTasks();

  const {
    data: entries = [],
    isLoading,
    isError,
    refetch,
  } = useGetTimeEntriesByTaskId(taskId);
  const { data: workspaceUsers } = useGetActiveWorkspaceUsers(workspaceId);
  const { data: globalRunning } = useGetRunningTimeEntry();
  const { mutateAsync: createTimeEntry, isPending: isSaving } =
    useCreateTimeEntry();
  const { mutateAsync: startTimeEntry, isPending: isStarting } =
    useStartTimeEntry();
  const { mutateAsync: stopTimeEntry, isPending: isStopping } =
    useStopTimeEntry(taskId);
  const { mutateAsync: deleteTimeEntry } = useDeleteTimeEntry(taskId);

  const items = entries as TimeEntryItem[];
  const runningItems = useMemo(
    () => items.filter((entry) => entry.endTime === null),
    [items],
  );
  const myRunning = useMemo(
    () => runningItems.find((entry) => entry.userId === user?.id) ?? null,
    [runningItems, user?.id],
  );
  const runningElsewhere =
    globalRunning && globalRunning.taskId !== taskId ? globalRunning : null;

  // Ticks totals once a second while anything runs. Elapsed values derive
  // from server timestamps at render; this is display only.
  useElapsed(runningItems[0]?.startTime ?? null);

  const liveSeconds = (startTime: string) =>
    Math.max(
      0,
      Math.floor((Date.now() - new Date(startTime).getTime()) / 1000),
    );

  // Computed every render (not memoized): the one-second tick above must
  // move live totals, so these intentionally recompute from Date.now().
  const liveTotal = runningItems.reduce(
    (sum, entry) => sum + liveSeconds(entry.startTime),
    0,
  );
  const total =
    items.reduce((sum, entry) => sum + (entry.duration ?? 0), 0) + liveTotal;

  const groups = (() => {
    const byUser = new Map<string, TimeEntryItem[]>();
    for (const entry of items) {
      const key = entry.userId ?? "";
      const list = byUser.get(key) ?? [];
      list.push(entry);
      byUser.set(key, list);
    }
    return [...byUser.entries()]
      .map(([userId, list]) => {
        const sorted = [...list].sort(
          (a, b) =>
            new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
        );
        const totalSeconds = sorted.reduce(
          (sum, entry) =>
            sum +
            (entry.endTime === null
              ? liveSeconds(entry.startTime)
              : (entry.duration ?? 0)),
          0,
        );
        const member = resolveEntryMember(
          workspaceUsers?.members,
          userId || null,
        );
        return { userId, list: sorted, totalSeconds, member };
      })
      .sort((a, b) => b.totalSeconds - a.totalSeconds);
  })();

  const handleSave = async (
    value: TimeEntryFormValue,
    afterSave?: () => void,
  ) => {
    try {
      await createTimeEntry({
        taskId,
        startTime: value.start.toISOString(),
        endTime: value.end.toISOString(),
        description: value.notes || undefined,
        billable: value.billable,
      });
      afterSave?.();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:timeTracking.updateError"),
      );
    }
  };

  const handleToggleTimer = async (notes = "", billable = true) => {
    try {
      if (myRunning) {
        await stopTimeEntry();
      } else {
        await startTimeEntry({
          taskId,
          description: notes || undefined,
          billable,
        });
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : myRunning
            ? t("tasks:timeTracking.stopError")
            : t("tasks:timeTracking.startError"),
      );
    }
  };

  // Instant delete, no confirm. Everything stays open; the row just drops
  // out once the lists refetch.
  const handleDelete = async (id: string) => {
    try {
      await deleteTimeEntry(id);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:timeTracking.deleteError"),
      );
    }
  };

  return {
    t,
    user,
    canEdit,
    items,
    isLoading,
    isError,
    refetch,
    workspaceUsers,
    runningItems,
    myRunning,
    runningElsewhere,
    liveSeconds,
    liveTotal,
    total,
    groups,
    isSaving,
    isStarting,
    isStopping,
    handleSave,
    handleToggleTimer,
    handleDelete,
  };
}

/**
 * The Layer 1 overview body without any trigger shell, so the task view
 * popover and the board/list context submenu render the same surface.
 */
export function TaskTimeTrackerContent({
  taskId,
  taskTitle,
  workspaceId,
  onManualSaved,
}: TaskTimeTrackerContentProps) {
  const view = useTaskTimeView(taskId, workspaceId);
  const {
    t,
    canEdit,
    items,
    isLoading,
    isError,
    refetch,
    workspaceUsers,
    myRunning,
    runningElsewhere,
    liveSeconds,
    total,
    groups,
    isSaving,
    isStarting,
    isStopping,
    handleSave,
    handleToggleTimer,
    handleDelete,
  } = view;

  return (
    <div className="flex flex-col">
      <div className="flex items-baseline justify-between gap-2 px-2 py-1.5">
        <p className="truncate text-xs font-semibold text-foreground">
          {t("tasks:timeTracking.timeOnTask")}
        </p>
        <p
          className="shrink-0 text-xs font-semibold text-foreground tabular-nums"
          title={`${formatDurationExact(total)} · ${items.length}`}
        >
          {formatDuration(total)}
        </p>
      </div>

      {canEdit && (
        <div className="flex flex-col gap-2 px-2 pb-2">
          <TimeEntryForm
            key={`manual-${taskId}`}
            initialStart={new Date()}
            initialEnd={new Date(Date.now() + 3600_000)}
            initialNotes=""
            initialBillable
            isPending={isSaving}
            requireDirty={false}
            onSave={(value) => void handleSave(value, onManualSaved)}
            liveElapsed={myRunning ? liveSeconds(myRunning.startTime) : null}
            hideSave={myRunning !== null}
            timer={{
              running: myRunning !== null,
              pending: isStarting || isStopping,
              onToggle: (notes, billable) =>
                void handleToggleTimer(notes, billable),
            }}
          />
          {runningElsewhere && !myRunning && (
            <p className="truncate text-[11px] text-muted-foreground">
              {t("tasks:timeTracking.trackingElsewhere", {
                taskTitle: runningElsewhere.taskTitle ?? "",
              })}
            </p>
          )}
        </div>
      )}

      <div className="border-t border-border pt-1">
        <p className="px-2 py-1 text-[11px] font-semibold text-muted-foreground">
          {t("tasks:timeTracking.timeEntries")}
        </p>
        {isLoading ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {t("common:empty.loading")}
          </p>
        ) : isError ? (
          <div className="flex items-center justify-between gap-2 px-2 py-3">
            <p className="text-xs text-muted-foreground">
              {t("tasks:timeTracking.loadError")}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="h-7 shrink-0 text-xs"
              onClick={() => void refetch()}
            >
              {t("common:error.tryAgain")}
            </Button>
          </div>
        ) : groups.length === 0 ? (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            {t("tasks:timeTracking.noEntries")}
          </p>
        ) : (
          <Accordion className="w-full">
            {groups.map((group) => {
              const name =
                group.member?.user?.name ??
                group.list[0]?.userName ??
                t("common:people.someone");
              return (
                <AccordionItem
                  key={group.userId || "unknown"}
                  value={group.userId || "unknown"}
                  className="border-none"
                >
                  <AccordionTrigger className="rounded-md px-2 py-1.5 hover:bg-accent/50 hover:no-underline">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <Avatar className="h-6 w-6 shrink-0">
                        <AvatarImage
                          src={group.member?.user?.image ?? ""}
                          alt={name}
                        />
                        <AvatarFallback className="text-[10px] font-medium">
                          {getInitials(name)}
                        </AvatarFallback>
                      </Avatar>
                      <span className="truncate text-xs font-medium text-foreground">
                        {name}
                      </span>
                      <span className="ml-auto shrink-0 text-[11px] text-muted-foreground tabular-nums">
                        {formatDuration(group.totalSeconds)}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="pb-1">
                    <div className="max-h-36 overflow-y-auto">
                      {group.list.map((entry) => (
                        <TimeEntryRow
                          key={entry.id}
                          entry={entry}
                          taskTitle={taskTitle}
                          members={workspaceUsers?.members}
                          canEdit={canEdit}
                          liveSeconds={
                            entry.endTime === null
                              ? liveSeconds(entry.startTime)
                              : undefined
                          }
                          onDeleteRequest={(id) => void handleDelete(id)}
                        />
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </div>
    </div>
  );
}

export default function TaskTimeTracker({
  taskId,
  taskTitle,
  workspaceId,
  compact = false,
}: TaskTimeTrackerProps) {
  const { t } = useTranslation();
  const view = useTaskTimeView(taskId, workspaceId);
  const {
    canEdit,
    items,
    runningItems,
    myRunning,
    runningElsewhere,
    liveTotal,
    total,
    isStarting,
    isStopping,
    handleToggleTimer,
  } = view;
  const [open, setOpen] = useState(false);

  return (
    <div className={cn("flex items-center gap-0.5", !compact && "w-full")}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <Button
              variant="ghost"
              size="sm"
              className={cn(
                "min-w-0 flex-1 justify-start gap-1.5 px-1.5",
                compact ? "h-7" : "h-7 w-full",
              )}
            />
          }
        >
          <Timer className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          <span
            className={cn(
              "truncate text-xs font-semibold tabular-nums",
              total === 0 && "text-muted-foreground",
            )}
            title={`${formatDurationExact(total)} · ${items.length}`}
          >
            {total === 0
              ? t("tasks:properties.timeTracked")
              : runningItems.length > 0
                ? formatDurationExact(liveTotal)
                : formatDuration(total)}
          </span>
          {myRunning && (
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
          )}
        </PopoverTrigger>
        <PopoverContent className="w-70 p-2" align="start">
          <TaskTimeTrackerContent
            taskId={taskId}
            taskTitle={taskTitle}
            workspaceId={workspaceId}
            onManualSaved={() => setOpen(false)}
          />
        </PopoverContent>
      </Popover>

      {canEdit && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 shrink-0 p-0"
          disabled={isStarting || isStopping}
          onClick={() => void handleToggleTimer()}
          aria-label={
            myRunning
              ? t("tasks:timeTracking.stop")
              : t("tasks:timeTracking.start")
          }
          title={
            myRunning
              ? t("tasks:timeTracking.stop")
              : runningElsewhere
                ? t("tasks:timeTracking.switchHere")
                : t("tasks:timeTracking.start")
          }
        >
          {myRunning ? (
            <Pause className="size-3.5" />
          ) : (
            <Play className="size-3.5" />
          )}
        </Button>
      )}
    </div>
  );
}
