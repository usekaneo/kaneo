import type { JSX } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import type { PackableTask, WeekSegment } from "./month-grid-model";

export type CalendarTask = PackableTask & {
  title: string;
  number: number | null;
  status: string;
};

const STATUS_CLASSES: Record<string, string> = {
  "to-do":
    "border-slate-500/35 bg-slate-500/15 hover:border-slate-500/50 hover:bg-slate-500/20",
  "in-progress":
    "border-blue-500/35 bg-blue-500/15 hover:border-blue-500/50 hover:bg-blue-500/20",
  "in-review":
    "border-amber-500/40 bg-amber-500/15 hover:border-amber-500/55 hover:bg-amber-500/20",
  done: "border-emerald-500/35 bg-emerald-500/15 hover:border-emerald-500/50 hover:bg-emerald-500/20",
};

export function getCalendarTaskStatusClass(status: string): string {
  return (
    STATUS_CLASSES[status] ??
    "border-primary/25 bg-primary/12 hover:border-primary/40 hover:bg-primary/18"
  );
}

type CalendarTaskBarProps = {
  segment: WeekSegment<CalendarTask>;
  projectSlug?: string;
  onOpenTask: (taskId: string) => void;
};

export default function CalendarTaskBar({
  segment,
  projectSlug,
  onOpenTask,
}: CalendarTaskBarProps): JSX.Element {
  const { t } = useTranslation();
  const {
    task,
    lane,
    columnStart,
    columnEnd,
    continuesBefore,
    continuesAfter,
  } = segment;

  const taskKey =
    projectSlug && task.number != null
      ? `${projectSlug}-${task.number}`
      : undefined;

  const range = `${formatDateShort(task.scheduleStart)} – ${formatDateShort(
    task.scheduleEnd,
  )}`;

  return (
    <button
      type="button"
      style={{
        gridColumn: `${columnStart} / ${columnEnd}`,
        // Row 1 holds the date numbers, so lanes start at row 2.
        gridRow: lane + 2,
      }}
      title={
        taskKey
          ? `${taskKey} · ${task.title} · ${range}`
          : `${task.title} · ${range}`
      }
      aria-label={t("tasks:calendar.taskAriaLabel", {
        title: task.title,
        range,
      })}
      data-task-status={task.status}
      onClick={() => onOpenTask(task.id)}
      className={cn(
        "z-10 mb-0.5 flex h-6 min-w-0 items-center overflow-hidden border px-1.5 text-left text-[11px] font-medium leading-none text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-5",
        getCalendarTaskStatusClass(task.status),
        // Bars that run past a week edge lose their cap there so the two halves
        // read as one continuous span across rows.
        continuesBefore ? "rounded-l-none border-l-0" : "ml-1 rounded-l-md",
        continuesAfter ? "rounded-r-none border-r-0" : "mr-1 rounded-r-md",
      )}
    >
      <span className="truncate">{task.title}</span>
    </button>
  );
}
