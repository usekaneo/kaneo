import { useT, useToast, useUpdateTask } from "@kaneo/plugin-sdk/web";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import {
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useState,
} from "react";
import { getBarGridColumns } from "./bar-grid-columns.js";
import { getBarLayout } from "./bar-layout.js";
import { cn } from "./cn.js";
import { type DateRange, type DragKind, dragRange } from "./drag-range.js";
import type { ScheduledTask } from "./scheduled-task.js";
import type { GanttTimeline } from "./timeline.js";

const CLICK_MOVE_THRESHOLD_PX = 4;
const MOBILE_MOVE_THRESHOLD_PX = 14;

type GanttTaskBarProps = {
  task: ScheduledTask;
  timeline: Pick<GanttTimeline, "days" | "rangeStart" | "gridTemplateColumns">;
  pixelsPerDay: number;
  isMobile?: boolean;
  onOpenTask: () => void;
};

export function GanttTaskBar({
  task,
  timeline,
  pixelsPerDay,
  isMobile = false,
  onOpenTask,
}: GanttTaskBarProps) {
  const t = useT();
  const toast = useToast();
  const updateTask = useUpdateTask();
  const [dragDisplay, setDragDisplay] = useState<DateRange | null>(null);

  useEffect(() => {
    if (!dragDisplay) return;
    const startMatches =
      differenceInCalendarDays(task.scheduleStart, dragDisplay.start) === 0;
    const endMatches =
      differenceInCalendarDays(task.scheduleEnd, dragDisplay.end) === 0;
    if (startMatches && endMatches) {
      setDragDisplay(null);
    }
  }, [dragDisplay, task.scheduleEnd, task.scheduleStart]);

  const displayStart = dragDisplay?.start ?? task.scheduleStart;
  const displayEnd = dragDisplay?.end ?? task.scheduleEnd;

  const trackCount = timeline.days.length;
  const { barInView, lineStart, lineEnd } = getBarGridColumns(
    displayStart,
    displayEnd,
    timeline.rangeStart,
    trackCount,
  );

  const startIsVisible =
    differenceInCalendarDays(task.scheduleStart, timeline.rangeStart) >= 0;
  const endIsVisible =
    differenceInCalendarDays(task.scheduleEnd, timeline.rangeStart) <
    trackCount;

  const persistDates = useCallback(
    async (next: DateRange): Promise<boolean> => {
      try {
        await updateTask(task.id, {
          startDate: startOfDay(next.start).toISOString(),
          dueDate: startOfDay(next.end).toISOString(),
        });
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : t("updateDatesError"),
        );
        return false;
      }
    },
    [task.id, updateTask, toast, t],
  );

  const pxPerDay = Math.max(pixelsPerDay, 1e-6);
  const moveThresholdPx = isMobile
    ? MOBILE_MOVE_THRESHOLD_PX
    : CLICK_MOVE_THRESHOLD_PX;

  const beginDrag = (kind: DragKind, originX: number) => {
    const initial = { start: task.scheduleStart, end: task.scheduleEnd };
    const rangeAt = (clientX: number) =>
      dragRange(
        kind,
        initial,
        timeline.days,
        timeline.rangeStart,
        clientX - originX,
        pxPerDay,
      );

    const onMove = (event: PointerEvent) => {
      setDragDisplay(rangeAt(event.clientX));
    };

    const onUp = async (event: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      if (event.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const next = rangeAt(event.clientX);
      if (
        kind === "move" &&
        Math.abs(event.clientX - originX) < moveThresholdPx
      ) {
        setDragDisplay(null);
        onOpenTask();
        return;
      }
      if (
        next.start.getTime() === initial.start.getTime() &&
        next.end.getTime() === initial.end.getTime()
      ) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(next);
      if (!ok) {
        setDragDisplay(null);
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  };

  const handleResizePointerDown =
    (kind: "start" | "end") => (event: ReactPointerEvent) => {
      event.preventDefault();
      event.stopPropagation();
      beginDrag(kind, event.clientX);
    };

  const handleMovePointerDown = (event: ReactPointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    if (!startIsVisible || !endIsVisible) {
      onOpenTask();
      return;
    }
    beginDrag("move", event.clientX);
  };

  if (!barInView || lineEnd <= lineStart) {
    return null;
  }

  const { labelOutside, showResizeHandles } = getBarLayout({
    isMobile,
    barWidthPx: (lineEnd - lineStart) * pxPerDay,
    lineEnd,
    trackCount,
  });

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] grid items-center"
      style={{
        gridTemplateColumns: timeline.gridTemplateColumns,
      }}
    >
      <div
        style={{ gridColumn: `${lineStart} / ${lineEnd}` }}
        className="group pointer-events-auto relative mx-1 flex min-h-[44px] min-w-0 items-stretch overflow-hidden rounded-md border border-primary/25 bg-background text-left text-sm font-medium leading-none text-foreground shadow-sm transition-colors hover:border-primary/40 sm:h-11 sm:min-h-0"
      >
        {showResizeHandles && (
          <button
            type="button"
            aria-label={t("resizeStart")}
            disabled={!startIsVisible}
            onPointerDown={handleResizePointerDown("start")}
            className={cn(
              "relative z-20 shrink-0 cursor-ew-resize touch-none border-r border-primary/15 bg-primary/8 hover:bg-primary/18",
              "min-h-[44px] w-6 sm:min-h-0 sm:w-2",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          />
        )}
        <button
          type="button"
          aria-label={t("taskAriaLabel", { title: task.title })}
          className="relative z-10 min-h-[44px] min-w-0 flex-1 cursor-grab touch-manipulation overflow-hidden px-2 text-left active:cursor-grabbing sm:min-h-0 sm:px-2.5"
          onPointerDown={handleMovePointerDown}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpenTask();
            }
          }}
        >
          <div className="absolute inset-0 z-0 bg-primary/12 transition-colors group-hover:bg-primary/18" />
          <span
            className={cn(
              "relative z-10 block truncate",
              labelOutside && "sr-only",
            )}
          >
            {task.title}
          </span>
        </button>
        {showResizeHandles && (
          <button
            type="button"
            aria-label={t("resizeDue")}
            disabled={!endIsVisible}
            onPointerDown={handleResizePointerDown("end")}
            className={cn(
              "relative z-20 shrink-0 cursor-ew-resize touch-none border-l border-primary/15 bg-primary/8 hover:bg-primary/18",
              "min-h-[44px] w-6 sm:min-h-0 sm:w-2",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          />
        )}
      </div>
      {labelOutside && (
        <span
          aria-hidden="true"
          style={{ gridColumn: `${lineEnd} / ${trackCount + 1}` }}
          className="min-w-0 truncate pl-1 text-xs font-medium text-foreground/80"
        >
          {task.title}
        </span>
      )}
    </div>
  );
}
