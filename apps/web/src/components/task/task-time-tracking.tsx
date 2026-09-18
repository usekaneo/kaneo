import { format } from "date-fns";
import {
  ChevronDown,
  ChevronRight,
  Play,
  Plus,
  Square,
  Trash2,
} from "lucide-react";
import { useId, useState } from "react";
import { useTranslation } from "react-i18next";
import useAuth from "@/components/providers/auth-provider/hooks/use-auth";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import useCreateTimeEntry from "@/hooks/mutations/time-entry/use-create-time-entry";
import useDeleteTimeEntry from "@/hooks/mutations/time-entry/use-delete-time-entry";
import useStopTimeEntry from "@/hooks/mutations/time-entry/use-stop-time-entry";
import useGetTimeEntriesByTaskId from "@/hooks/queries/time-entry/use-get-time-entries";
import { useNow } from "@/hooks/use-now";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { formatClock, formatHours } from "@/lib/format-duration";
import { toast } from "@/lib/toast";

type Props = {
  taskId: string;
};

function secondsOf(
  entry: { startTime: string; endTime: string | null; duration: number | null },
  now: Date,
) {
  if (entry.endTime && entry.duration !== null) return entry.duration;
  return Math.max(
    0,
    Math.floor((now.getTime() - new Date(entry.startTime).getTime()) / 1000),
  );
}

function ManualEntryForm({
  taskId,
  onDone,
}: {
  taskId: string;
  onDone: () => void;
}) {
  const { t } = useTranslation();
  const { mutateAsync: createTimeEntry, isPending } = useCreateTimeEntry();
  const [date, setDate] = useState(() => format(new Date(), "yyyy-MM-dd"));
  const [from, setFrom] = useState("09:00");
  const [to, setTo] = useState("10:00");
  const [note, setNote] = useState("");
  const id = useId();

  const save = async () => {
    // Local wall-clock times; toISOString converts them to UTC for the API.
    const start = new Date(`${date}T${from}`);
    const end = new Date(`${date}T${to}`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      toast.error(t("time:task.invalidTime"));
      return;
    }
    if (end <= start) {
      toast.error(t("time:task.endBeforeStart"));
      return;
    }
    try {
      await createTimeEntry({
        taskId,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        description: note.trim() || undefined,
      });
      toast.success(t("time:task.added"));
      onDone();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("time:task.addError"),
      );
    }
  };

  return (
    <div className="mt-2 space-y-2 rounded-md border border-border p-3">
      <div className="grid grid-cols-3 gap-2">
        <div className="space-y-1">
          <Label
            htmlFor={`${id}-date`}
            className="text-xs text-muted-foreground"
          >
            {t("time:task.date")}
          </Label>
          <Input
            id={`${id}-date`}
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label
            htmlFor={`${id}-from`}
            className="text-xs text-muted-foreground"
          >
            {t("time:task.from")}
          </Label>
          <Input
            id={`${id}-from`}
            type="time"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor={`${id}-to`} className="text-xs text-muted-foreground">
            {t("time:task.to")}
          </Label>
          <Input
            id={`${id}-to`}
            type="time"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
      </div>
      <Input
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder={t("time:task.notePlaceholder")}
        aria-label={t("time:task.note")}
      />
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="xs" onClick={onDone}>
          {t("common:actions.cancel")}
        </Button>
        <Button size="xs" onClick={save} disabled={isPending}>
          {t("time:task.save")}
        </Button>
      </div>
    </div>
  );
}

export default function TaskTimeTracking({ taskId }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { data: entries = [] } = useGetTimeEntriesByTaskId(taskId);
  const { mutateAsync: createTimeEntry, isPending: isStarting } =
    useCreateTimeEntry();
  const { mutateAsync: stopTimeEntry, isPending: isStopping } =
    useStopTimeEntry();
  const { mutateAsync: deleteTimeEntry } = useDeleteTimeEntry();
  const { canUpdateTasks, canManageEveryonesTime } = useWorkspacePermission();
  const [isOpen, setIsOpen] = useState(false);
  const [isAdding, setIsAdding] = useState(false);

  const mine = entries.find((e) => !e.endTime && e.userId === user?.id);
  const anyRunning = entries.some((e) => !e.endTime);
  const now = useNow(anyRunning);
  const total = entries.reduce((sum, e) => sum + secondsOf(e, now), 0);
  const canTrack = Boolean(canUpdateTasks());

  const start = async () => {
    try {
      await createTimeEntry({ taskId, startTime: new Date().toISOString() });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("time:task.startError"),
      );
    }
  };

  const stop = async () => {
    if (!mine) return;
    try {
      await stopTimeEntry(mine.id);
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("time:task.stopError"),
      );
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteTimeEntry(id);
      toast.success(t("time:task.deleted"));
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : t("time:task.deleteError"),
      );
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
              <span>{t("time:task.title")}</span>
            </button>
          </CollapsibleTrigger>
          {total > 0 && (
            <span className="text-xs text-muted-foreground tabular-nums">
              {formatHours(total)}
            </span>
          )}
        </div>
        {canTrack && (
          <div className="flex items-center gap-1">
            {mine ? (
              <Button
                variant="outline"
                size="xs"
                onClick={stop}
                disabled={isStopping}
                aria-label={t("time:task.stop")}
              >
                <Square className="size-3 fill-current" />
                <span className="tabular-nums">
                  {formatClock(secondsOf(mine, now))}
                </span>
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="xs"
                className="text-muted-foreground"
                onClick={start}
                disabled={isStarting}
              >
                <Play className="size-3.5" />
                {t("time:task.start")}
              </Button>
            )}
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              aria-label={t("time:task.addManual")}
              onClick={() => {
                setIsOpen(true);
                setIsAdding(true);
              }}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <CollapsibleContent>
        {isAdding && (
          <ManualEntryForm taskId={taskId} onDone={() => setIsAdding(false)} />
        )}
        {entries.length === 0 && !isAdding ? (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {t("time:task.empty")}
          </p>
        ) : (
          <ul className="mt-1.5">
            {[...entries].reverse().map((entry) => {
              const canRemove =
                (entry.userId !== null && entry.userId === user?.id) ||
                Boolean(canManageEveryonesTime());
              const startTime = new Date(entry.startTime);
              return (
                <li
                  key={entry.id}
                  className="group flex items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/50"
                >
                  <span className="min-w-0 flex-1 truncate">
                    <span className="text-foreground">
                      {entry.userName ?? t("time:task.formerMember")}
                    </span>
                    <span className="text-muted-foreground">
                      {" · "}
                      {format(startTime, "MMM d, HH:mm")}
                      {entry.endTime
                        ? `–${format(new Date(entry.endTime), "HH:mm")}`
                        : ` · ${t("time:task.running")}`}
                      {entry.description ? ` · ${entry.description}` : ""}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {formatHours(secondsOf(entry, now))}
                  </span>
                  {canRemove && (
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className="opacity-0 group-hover:opacity-100 focus-visible:opacity-100 text-muted-foreground"
                      aria-label={t("time:task.delete")}
                      onClick={() => remove(entry.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
