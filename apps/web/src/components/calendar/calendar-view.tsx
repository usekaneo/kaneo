import {
  addDays,
  addMonths,
  differenceInCalendarDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { cn } from "@/lib/cn";
import { dueDateStatusColors, getDueDateStatus } from "@/lib/due-date-status";
import { toast } from "@/lib/toast";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";

type CalendarMode = "month" | "week";

type CalendarViewProps = {
  tasks: Task[];
  onOpenTask: (taskId: string) => void;
};

type ScheduledTask = {
  task: Task;
  start: Date;
  end: Date;
};

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : startOfDay(date);
}

function toIsoDay(date: Date): string {
  return startOfDay(date).toISOString();
}

function getScheduledTask(task: Task): ScheduledTask | null {
  const start = parseDate(task.startDate) ?? parseDate(task.dueDate);
  const end = parseDate(task.dueDate) ?? parseDate(task.startDate);
  if (!start || !end) return null;
  return start <= end ? { task, start, end } : { task, start: end, end: start };
}

function getTaskPosition(item: ScheduledTask, day: Date) {
  const starts = isSameDay(item.start, day);
  const ends = isSameDay(item.end, day);
  return {
    starts,
    ends,
    className: cn(
      "rounded-md",
      !starts && "rounded-l-none",
      !ends && "rounded-r-none",
    ),
  };
}

export default function CalendarView({ tasks, onOpenTask }: CalendarViewProps) {
  const { t } = useTranslation();
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const calendarMode = useUserPreferencesStore((state) => state.calendarMode);
  const setCalendarMode = useUserPreferencesStore(
    (state) => state.setCalendarMode,
  );
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()));
  const [draggedTaskId, setDraggedTaskId] = useState<string | null>(null);
  const [dragTarget, setDragTarget] = useState<string | null>(null);
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const suppressClick = useRef(false);
  const { mutateAsync: updateTask } = useUpdateTask();

  const scheduledTasks = useMemo(
    () =>
      tasks
        .map(getScheduledTask)
        .filter((item): item is ScheduledTask => item !== null),
    [tasks],
  );

  const days = useMemo(() => {
    const start = startOfWeek(
      calendarMode === "month" ? startOfMonth(cursor) : cursor,
      { weekStartsOn },
    );
    const end =
      calendarMode === "month"
        ? endOfWeek(endOfMonth(cursor), { weekStartsOn })
        : endOfWeek(cursor, { weekStartsOn });
    return eachDayOfInterval({ start, end });
  }, [calendarMode, cursor, weekStartsOn]);

  const moveCursor = (amount: number) => {
    setCursor((current) =>
      calendarMode === "month"
        ? addMonths(current, amount)
        : addDays(current, amount * 7),
    );
  };

  const goToToday = () => setCursor(new Date());

  const tasksForDay = (day: Date) =>
    scheduledTasks.filter((item) => day >= item.start && day <= item.end);

  const persistDrop = async (task: Task, day: Date) => {
    const start = parseDate(task.startDate);
    const due = parseDate(task.dueDate);
    const anchor = start ?? due;
    if (!anchor) return;

    const delta = differenceInCalendarDays(day, anchor);
    setPendingTaskId(task.id);
    try {
      await updateTask({
        ...task,
        startDate: start ? toIsoDay(addDays(start, delta)) : null,
        dueDate: due ? toIsoDay(addDays(due, delta)) : null,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("tasks:calendar.updateError"),
      );
    } finally {
      setPendingTaskId(null);
    }
  };

  const headerLabel =
    calendarMode === "month"
      ? format(cursor, "MMMM yyyy")
      : `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`;

  return (
    <div className="flex min-h-0 flex-1 flex-col p-3 sm:p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("tasks:calendar.previous")}
            onClick={() => moveCursor(-1)}
          >
            <ChevronLeft className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            aria-label={t("tasks:calendar.next")}
            onClick={() => moveCursor(1)}
          >
            <ChevronRight className="size-4" />
          </Button>
          <Button variant="outline" size="xs" onClick={goToToday}>
            {t("tasks:calendar.today")}
          </Button>
          <h2 className="ml-2 text-sm font-semibold">{headerLabel}</h2>
        </div>
        <div className="flex rounded-md border p-0.5">
          {(["month", "week"] as CalendarMode[]).map((mode) => (
            <Button
              key={mode}
              variant={calendarMode === mode ? "secondary" : "ghost"}
              size="xs"
              onClick={() => setCalendarMode(mode)}
            >
              {t(`tasks:calendar.${mode}`)}
            </Button>
          ))}
        </div>
      </div>

      {scheduledTasks.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
          {t("tasks:calendar.empty")}
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="grid min-w-[42rem] grid-cols-7 border-l border-t">
            {days.slice(0, 7).map((day) => (
              <div
                key={day.toISOString()}
                className="border-r border-b px-2 py-2 text-[11px] font-medium text-muted-foreground"
              >
                {format(day, "EEE")}
              </div>
            ))}
            {days.map((day) => (
              // biome-ignore lint/a11y/useSemanticElements: calendar gridcell preserves drop target semantics
              <div
                key={day.toISOString()}
                data-calendar-day={day.toISOString()}
                role="gridcell"
                tabIndex={0}
                aria-label={format(day, "PPPP")}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTarget(day.toISOString());
                }}
                onDragLeave={() => setDragTarget(null)}
                onDrop={(event) => {
                  event.preventDefault();
                  const item = scheduledTasks.find(
                    ({ task }) =>
                      task.id === event.dataTransfer.getData("task-id"),
                  );
                  setDraggedTaskId(null);
                  setDragTarget(null);
                  if (item) void persistDrop(item.task, day);
                }}
                className={cn(
                  "min-h-24 border-r border-b p-1.5 transition-colors",
                  calendarMode === "month" &&
                    !isSameMonth(day, cursor) &&
                    "bg-muted/20 text-muted-foreground",
                  day.getDay() === 0 || day.getDay() === 6
                    ? "bg-muted/10"
                    : undefined,
                  isSameDay(day, new Date()) && "bg-primary/5",
                  dragTarget === day.toISOString() &&
                    "bg-primary/15 ring-2 ring-inset ring-primary/40",
                )}
              >
                <div className="mb-1 text-xs">{format(day, "d")}</div>
                <div className="space-y-1">
                  {tasksForDay(day).map((item) => {
                    const position = getTaskPosition(item, day);
                    const status = getDueDateStatus(item.task.dueDate);
                    return (
                      <button
                        type="button"
                        key={`${item.task.id}-${day.toISOString()}`}
                        draggable
                        title={item.task.title}
                        aria-label={t("tasks:calendar.taskAriaLabel", {
                          title: item.task.title,
                        })}
                        onDragStart={(event) => {
                          event.dataTransfer.setData("task-id", item.task.id);
                          event.dataTransfer.effectAllowed = "move";
                          suppressClick.current = false;
                          setDraggedTaskId(item.task.id);
                        }}
                        onDragEnd={() => {
                          suppressClick.current = true;
                          setDraggedTaskId(null);
                          setDragTarget(null);
                        }}
                        onClick={() => {
                          if (suppressClick.current) {
                            suppressClick.current = false;
                            return;
                          }
                          onOpenTask(item.task.id);
                        }}
                        className={cn(
                          "cursor-grab truncate px-1.5 py-1 text-left text-[11px] transition-opacity active:cursor-grabbing",
                          "border-0 bg-transparent",
                          dueDateStatusColors[status],
                          position.className,
                          draggedTaskId === item.task.id && "opacity-40",
                          pendingTaskId === item.task.id &&
                            "pointer-events-none opacity-60",
                        )}
                      >
                        {item.task.title}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
