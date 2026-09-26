import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { AlertTriangle, Diamond, Flag, Link2 as Link2Icon } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useUpdateTask } from "@/hooks/mutations/task/use-update-task";
import { cn } from "@/lib/cn";
import { formatDateShort } from "@/lib/format";
import { toast } from "@/lib/toast";
import type Task from "@/types/task";
import { computeConstraintViolations } from "./gantt-constraint-violations";
import {
  computeInsetBarBox,
  computeProgressFillPercent,
  deriveTaskSchedule,
  type GanttBarEmphasis,
  getBarEdgeInsetPx,
  getBarGridColumns,
  MIN_BAR_CONTENT_PX,
} from "./timeline";

const CLICK_MOVE_THRESHOLD_PX = 4;
const MOBILE_MOVE_THRESHOLD_PX = 14;

type ScheduledTask = Task & {
  scheduleStart: Date;
  scheduleEnd: Date;
};

type GanttTaskBarProps = {
  task: ScheduledTask;
  timeline: {
    days: Date[];
    rangeStart: Date;
    gridTemplateColumns: string;
  };
  pixelsPerDay: number;
  isMobile?: boolean;
  onOpenTask: () => void;
  /** How this bar renders relative to a hovered dependency (default "normal"). */
  emphasis?: GanttBarEmphasis;
  /** Whether this task sits on the currently-highlighted critical path (see
   * gantt-critical-path.ts) — an accent independent of `emphasis`, since a
   * hovered dependency and the critical-path toggle can both be active at
   * once and both need to stay legible. */
  isCritical?: boolean;
  /** Notified on hover and keyboard focus, to drive dependency-line highlighting. */
  onHoverChange?: (hovering: boolean) => void;
  /** Pointerdown on the "drag to link" handle at the bar's finish edge —
   * distinct from move/resize, this starts a gesture (owned by the Gantt
   * route, which can see every other bar's box) that creates a "blocks"
   * relation when released over another bar. */
  onLinkDragStart?: (event: React.PointerEvent, taskId: string) => void;
  /** Notified after a drag-move or resize successfully persists this task's
   * own new start/due date — never on a no-op or a failed persist. The
   * Gantt route uses this to cascade a forward push through any "blocks"
   * dependents (see gantt-dependency-cascade.ts); it never affects this
   * bar's own rendering. */
  onDatesCommitted?: (taskId: string, start: Date, end: Date) => void;
};

export function toIsoDay(d: Date) {
  return startOfDay(d).toISOString();
}

export function GanttTaskBar({
  task,
  timeline,
  pixelsPerDay,
  isMobile = false,
  onOpenTask,
  emphasis = "normal",
  isCritical = false,
  onHoverChange,
  onLinkDragStart,
  onDatesCommitted,
}: GanttTaskBarProps) {
  const { t } = useTranslation();
  const { mutateAsync: updateTask } = useUpdateTask();
  const [dragDisplay, setDragDisplay] = useState<{
    start: Date;
    end: Date;
  } | null>(null);

  // Drop the drag overlay once server data matches
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
    async (nextStart: Date, nextEnd: Date): Promise<boolean> => {
      try {
        await updateTask({
          ...task,
          startDate: toIsoDay(nextStart),
          dueDate: toIsoDay(nextEnd),
        });
        return true;
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : t("tasks:gantt.updateDatesError"),
        );
        return false;
      }
    },
    [task, updateTask, t],
  );

  const pxPerDay = Math.max(pixelsPerDay, 1e-6);
  const moveThresholdPx = isMobile
    ? MOBILE_MOVE_THRESHOLD_PX
    : CLICK_MOVE_THRESHOLD_PX;

  const handleResizeLeftPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX;
    const initialStart = task.scheduleStart;
    const initialEnd = task.scheduleEnd;
    const startIdx = differenceInCalendarDays(
      initialStart,
      timeline.rangeStart,
    );
    const endIdx = differenceInCalendarDays(initialEnd, timeline.rangeStart);

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, endIdx));
      const nextStart = timeline.days[nextStartIdx] ?? initialStart;
      const nextEnd = initialEnd;
      setDragDisplay({ start: nextStart, end: nextEnd });
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (ev.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, endIdx));
      const nextStart = timeline.days[nextStartIdx] ?? initialStart;
      if (nextStart.getTime() === initialStart.getTime()) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(nextStart, initialEnd);
      if (!ok) {
        setDragDisplay(null);
      } else {
        onDatesCommitted?.(task.id, nextStart, initialEnd);
      }
    };

    const onCancel = onUp;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const handleResizeRightPointerDown = (event: React.PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const originX = event.clientX;
    const initialStart = task.scheduleStart;
    const initialEnd = task.scheduleEnd;
    const startIdx = differenceInCalendarDays(
      initialStart,
      timeline.rangeStart,
    );
    const endIdx = differenceInCalendarDays(initialEnd, timeline.rangeStart);

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextEndIdx = endIdx + deltaDays;
      nextEndIdx = Math.max(startIdx, Math.min(nextEndIdx, trackCount - 1));
      const nextEnd = timeline.days[nextEndIdx] ?? initialEnd;
      const nextStart = initialStart;
      setDragDisplay({ start: nextStart, end: nextEnd });
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (ev.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextEndIdx = endIdx + deltaDays;
      nextEndIdx = Math.max(startIdx, Math.min(nextEndIdx, trackCount - 1));
      const nextEnd = timeline.days[nextEndIdx] ?? initialEnd;
      if (nextEnd.getTime() === initialEnd.getTime()) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(initialStart, nextEnd);
      if (!ok) {
        setDragDisplay(null);
      } else {
        onDatesCommitted?.(task.id, initialStart, nextEnd);
      }
    };

    const onCancel = onUp;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  const handleMovePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const originX = event.clientX;
    const initialStart = task.scheduleStart;
    const initialEnd = task.scheduleEnd;
    if (!startIsVisible || !endIsVisible) {
      onOpenTask();
      return;
    }
    const durationDays = differenceInCalendarDays(initialEnd, initialStart);
    const startIdx = differenceInCalendarDays(
      initialStart,
      timeline.rangeStart,
    );

    const onMove = (ev: PointerEvent) => {
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      const maxStart = trackCount - 1 - durationDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, maxStart));
      const nextStart = timeline.days[nextStartIdx] ?? initialStart;
      const nextEnd = addDays(nextStart, durationDays);
      setDragDisplay({ start: nextStart, end: nextEnd });
    };

    const onUp = async (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      if (ev.type === "pointercancel") {
        setDragDisplay(null);
        return;
      }
      const moved = Math.abs(ev.clientX - originX);
      const deltaDays = Math.round((ev.clientX - originX) / pxPerDay);
      let nextStartIdx = startIdx + deltaDays;
      const maxStart = trackCount - 1 - durationDays;
      nextStartIdx = Math.max(0, Math.min(nextStartIdx, maxStart));
      const nextStart = timeline.days[nextStartIdx] ?? initialStart;
      const nextEnd = addDays(nextStart, durationDays);

      if (moved < moveThresholdPx) {
        setDragDisplay(null);
        onOpenTask();
        return;
      }
      if (
        nextStart.getTime() === initialStart.getTime() &&
        nextEnd.getTime() === initialEnd.getTime()
      ) {
        setDragDisplay(null);
        return;
      }
      const ok = await persistDates(nextStart, nextEnd);
      if (!ok) {
        setDragDisplay(null);
      } else {
        onDatesCommitted?.(task.id, nextStart, nextEnd);
      }
    };

    const onCancel = onUp;

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
  };

  // The link handle only starts the gesture; the Gantt route (which can see
  // every other bar's measured box) owns the preview line, drop hit-testing,
  // and the mutation itself — see handleLinkDragStart in gantt.tsx.
  // stopPropagation keeps this pointerdown from ever reaching the move
  // button's own handler or the chart's drag-to-pan listener (the latter
  // already excludes any `<button>` target, but this is a plain button and
  // sits inside the bar the same way the resize handles do, so it follows
  // their same preventDefault+stopPropagation convention).
  const handleLinkHandlePointerDown = (event: React.PointerEvent) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.stopPropagation();
    onLinkDragStart?.(event, task.id);
  };

  // A milestone is a point in time, not a span: it renders at its own date
  // (task.scheduleStart already resolves to startDate, or dueDate if start is
  // absent — see deriveTaskSchedule) rather than at whatever range
  // barInView/lineStart/lineEnd above computed from displayStart/displayEnd,
  // which for a milestone that still carries both dates from before it was
  // marked one would otherwise draw a multi-day span.
  const milestoneGrid = getBarGridColumns(
    task.scheduleStart,
    task.scheduleStart,
    timeline.rangeStart,
    trackCount,
  );

  // Baseline (plan vs actual): a thin, muted underlay spanning the snapshot
  // taken when the baseline was last set, independent of barInView above —
  // it has its own date range and its own in-view check.
  const baselineSchedule = deriveTaskSchedule(
    task.baselineStartDate,
    task.baselineDueDate,
  );
  const baselineGrid = baselineSchedule
    ? getBarGridColumns(
        baselineSchedule.start,
        baselineSchedule.end,
        timeline.rangeStart,
        trackCount,
      )
    : null;

  // Baseline underlay is independent of the bar's own in-view state (below):
  // a task that has drifted far enough off its baseline to have scrolled
  // out of the current window — the exact case this feature exists to show
  // — must not lose its baseline underlay just because the actual bar isn't
  // on screen. Computed here, before the `isInView` bailout, so that
  // bailout can still return it instead of `null`.
  const baselineUnderlay = baselineGrid?.barInView ? (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0.5 z-0 grid"
      style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
    >
      <div
        style={{
          gridColumn: `${baselineGrid.lineStart} / ${baselineGrid.lineEnd}`,
        }}
        className="mx-1 h-1 rounded-full bg-muted-foreground/40 dark:bg-muted-foreground/50"
        title={t("tasks:properties.baseline")}
        aria-hidden="true"
      />
    </div>
  ) : null;

  const isInView = task.isMilestone ? milestoneGrid.barInView : barInView;

  if (!isInView) {
    return baselineUnderlay;
  }

  // Task date constraint (Phase 3c-ii): a small pin at the constraint date,
  // plus a distinct warning badge when the task's own dates violate it (see
  // gantt-constraint-violations.ts) — kept visually apart from the red
  // dependency lines (a line, not an icon), the amber critical-path outline,
  // and the milestone diamond (a different shape/position), so all four can
  // never be mistaken for one another.
  const constraintType = task.constraintType ?? "none";
  const constraintDateValue = task.constraintDate
    ? new Date(task.constraintDate)
    : null;
  const hasConstraint =
    constraintType !== "none" && constraintDateValue !== null;
  const constraintGrid =
    hasConstraint && constraintDateValue
      ? getBarGridColumns(
          constraintDateValue,
          constraintDateValue,
          timeline.rangeStart,
          trackCount,
        )
      : null;
  const isConstraintViolated = hasConstraint
    ? computeConstraintViolations([task]).has(task.id)
    : false;
  const constraintTypeLabel = hasConstraint
    ? t(`tasks:popover.constraint.type.${constraintType}`)
    : "";
  const constraintDateLabel = constraintDateValue
    ? formatDateShort(constraintDateValue)
    : "";

  // The pin itself: always shown for a constrained task, positioned at its
  // own constraint date (which need not fall inside the bar's own span —
  // e.g. an SNET/FNLT violation puts it outside). A distinct sky color and
  // shape (a small flag in a circle) from every other Gantt accent.
  const constraintMarker = constraintGrid?.barInView ? (
    <div
      className="pointer-events-none absolute inset-x-0 top-0 z-[2] grid"
      style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
    >
      <div
        style={{
          gridColumn: `${constraintGrid.lineStart} / ${constraintGrid.lineEnd}`,
        }}
        className="pointer-events-auto relative flex justify-center"
      >
        <span
          role="img"
          aria-label={t("tasks:gantt.constraintMarkerAriaLabel", {
            title: task.title,
            type: constraintTypeLabel,
            date: constraintDateLabel,
          })}
          title={t("tasks:gantt.constraintMarkerAriaLabel", {
            title: task.title,
            type: constraintTypeLabel,
            date: constraintDateLabel,
          })}
          className="absolute -top-2 flex size-4 items-center justify-center rounded-full border border-sky-500/60 bg-background text-sky-600 shadow-sm dark:border-sky-400/50 dark:text-sky-400"
        >
          <Flag className="size-2.5" aria-hidden="true" />
        </span>
      </div>
    </div>
  ) : null;

  // The violation badge: only when this task's own dates actually break its
  // constraint. Red is reused here deliberately (see file header decision in
  // gantt-constraint-violations.ts's caller) — it's a conventional
  // "deadline missed" warning color, but as a small corner icon rather than
  // a line, it can't be confused with a blocking dependency line.
  const violationBadge = isConstraintViolated ? (
    <span
      role="img"
      aria-label={t("tasks:gantt.constraintViolationAriaLabel", {
        title: task.title,
        type: constraintTypeLabel,
        date: constraintDateLabel,
      })}
      title={t("tasks:gantt.constraintViolationAriaLabel", {
        title: task.title,
        type: constraintTypeLabel,
        date: constraintDateLabel,
      })}
      className="pointer-events-auto absolute -top-1.5 -right-1.5 z-30 flex size-4 items-center justify-center rounded-full border border-destructive/70 bg-background text-destructive shadow-sm"
    >
      <AlertTriangle className="size-2.5" aria-hidden="true" />
    </span>
  ) : null;

  // React's onBlur/onFocus fire from bubbling focusout/focusin, so tabbing
  // between this bar's own resize-start/move/resize-due buttons fires a
  // blur on the outgoing button immediately followed by a focus on the
  // incoming one — both bubbling up to this wrapper. Treated naively that's
  // an onHoverChange(false) then (true), which briefly clears (and
  // flickers) the dependency-line highlight for a focus move that never
  // actually left the bar. `relatedTarget` is the element focus is moving
  // to, so only report a real "left the bar" blur when it's outside this
  // wrapper; a focus move within the bar is silently absorbed (the
  // subsequent onFocus below is a harmless no-op re-affirmation).
  const handleBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    onHoverChange?.(false);
  };

  if (task.isMilestone) {
    return (
      <>
        {baselineUnderlay}
        <div
          className="pointer-events-none absolute inset-0 z-[1] grid items-center"
          style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
        >
          {/* biome-ignore lint/a11y/noStaticElementInteractions: hover/focus tracking drives dependency-line highlighting; the actual interactive control is the button nested below */}
          <div
            style={{
              gridColumn: `${milestoneGrid.lineStart} / ${milestoneGrid.lineEnd}`,
            }}
            onMouseEnter={() => onHoverChange?.(true)}
            onMouseLeave={() => onHoverChange?.(false)}
            onFocus={() => onHoverChange?.(true)}
            onBlur={handleBlur}
            className="pointer-events-auto relative flex min-h-[44px] items-center justify-center sm:min-h-0"
          >
            <button
              type="button"
              aria-label={t("tasks:gantt.milestoneAriaLabel", {
                title: task.title,
              })}
              onClick={onOpenTask}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenTask();
                }
              }}
              className={cn(
                "flex size-5 shrink-0 touch-manipulation items-center justify-center rounded-sm text-primary transition-colors hover:text-primary/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 sm:size-4",
                emphasis === "highlighted" && "ring-2 ring-primary/40",
                emphasis === "dimmed" && "opacity-35",
                // Critical-path accent: a distinct outline (not a color swap
                // and not red, which already means "blocking" on the
                // dependency lines) so it reads on its own and layers
                // cleanly with the hover ring above. `outline` is a separate
                // box property from the box-shadow-based ring, so both can
                // be visible together.
                isCritical &&
                  "outline outline-2 outline-offset-2 outline-warning",
              )}
            >
              <Diamond className="size-full fill-primary/30" />
            </button>
            {violationBadge}
          </div>
        </div>
      </>
    );
  }

  // Own tasks' bars always know their real pixel width (pixelsPerDay is
  // measured from the actual rendered grid), so the margin/min-width that
  // keeps a bar visible at very narrow Month/Quarter columns (see
  // computeInsetBarBox in timeline.ts) can be computed directly here, rather
  // than relying on a fixed CSS margin that would just clamp to invisible
  // once the day-column width shrinks below it.
  const trackWidthPx = pixelsPerDay * (lineEnd - lineStart);
  const insetBox = computeInsetBarBox(0, trackWidthPx, getBarEdgeInsetPx());

  // True progress over the task's FULL span, clipped to what's currently on
  // screen (see computeProgressFillPercent) — not a percentage of the
  // window-clipped bar itself, which would misrepresent progress once the
  // bar extends past either window edge.
  const progressFillPercent = computeProgressFillPercent(
    task.progress,
    displayStart,
    displayEnd,
    timeline.rangeStart,
    lineStart,
    lineEnd,
  );

  return (
    <>
      {baselineUnderlay}
      {constraintMarker}
      <div
        className="pointer-events-none absolute inset-0 z-[1] grid items-center"
        style={{
          gridTemplateColumns: timeline.gridTemplateColumns,
        }}
      >
        {/* The outer cell only places this bar on the grid and hosts the link
            handle below; "group" lives here (not on the inner, clipped bar)
            so the handle — a sibling positioned outside the inner div's
            overflow-hidden bounds — still lights up on `group-hover`/
            `group-focus-within`, since a descendant's :hover/:focus-within
            bubbles up to this ancestor regardless of which child is
            hovered/focused. */}
        <div
          style={{ gridColumn: `${lineStart} / ${lineEnd}` }}
          className="group relative"
        >
          {violationBadge}
          {/* biome-ignore lint/a11y/noStaticElementInteractions: hover/focus tracking drives dependency-line highlighting; the actual interactive controls are the buttons nested below */}
          <div
            style={{
              marginInline: `${insetBox.insetPx}px`,
              minWidth: `${MIN_BAR_CONTENT_PX}px`,
            }}
            onMouseEnter={() => onHoverChange?.(true)}
            onMouseLeave={() => onHoverChange?.(false)}
            onFocus={() => onHoverChange?.(true)}
            onBlur={handleBlur}
            className={cn(
              "pointer-events-auto relative flex min-h-[44px] min-w-0 items-stretch overflow-hidden rounded-md border border-primary/25 bg-background text-left text-sm font-medium leading-none text-foreground shadow-sm transition-[opacity,border-color] hover:border-primary/40 sm:h-11 sm:min-h-0",
              emphasis === "highlighted" &&
                "border-primary/60 ring-2 ring-primary/40",
              emphasis === "dimmed" && "opacity-35",
              // Critical-path accent (see the milestone diamond above for
              // why this is `outline`, not a ring/color swap).
              isCritical &&
                "outline outline-2 outline-offset-2 outline-warning",
            )}
          >
            {progressFillPercent > 0 && (
              <div
                className="pointer-events-none absolute inset-y-0 left-0 z-0 bg-primary/30 dark:bg-primary/40"
                style={{ width: `${progressFillPercent}%` }}
                aria-hidden="true"
              />
            )}
            <button
              type="button"
              aria-label={t("tasks:gantt.resizeStart")}
              disabled={!startIsVisible}
              onPointerDown={handleResizeLeftPointerDown}
              className={cn(
                "relative z-20 shrink-0 cursor-ew-resize touch-none border-r border-primary/15 bg-primary/8 hover:bg-primary/18",
                "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:w-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            />
            <button
              type="button"
              aria-label={t("tasks:gantt.taskAriaLabel", { title: task.title })}
              className="relative z-10 min-h-[44px] min-w-0 flex-1 cursor-grab touch-manipulation overflow-hidden px-2 text-left active:cursor-grabbing sm:min-h-0 sm:px-2.5"
              onPointerDown={handleMovePointerDown}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpenTask();
                }
              }}
            >
              <div className="absolute inset-0 z-0 bg-primary/12 transition-colors group-hover:bg-primary/18" />
              <span className="relative z-10 block truncate">
                {task.title}
              </span>
            </button>
            <button
              type="button"
              aria-label={t("tasks:gantt.resizeDue")}
              disabled={!endIsVisible}
              onPointerDown={handleResizeRightPointerDown}
              className={cn(
                "relative z-20 shrink-0 cursor-ew-resize touch-none border-l border-primary/15 bg-primary/8 hover:bg-primary/18",
                "min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 sm:w-2",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
              )}
            />
          </div>
          {/* "Drag to link" handle: a small dot at the bar's finish edge,
              hidden until the bar is hovered/focused so it doesn't compete
              visually with the move/resize affordances. Positioned at
              insetBox.right — the same edge the dependency-line overlay
              itself anchors a finish-to-start line to (see taskBoxes in
              gantt.tsx, built from this same computeInsetBarBox call) — and
              outside the inner bar's overflow-hidden bounds so it isn't
              clipped. onPointerDown only starts the gesture; gantt.tsx owns
              the preview line, drop hit-testing, and the mutation. */}
          <button
            type="button"
            aria-label={t("tasks:gantt.linkHandleAriaLabel", {
              title: task.title,
            })}
            title={t("tasks:gantt.linkHandleAriaLabel", { title: task.title })}
            onPointerDown={handleLinkHandlePointerDown}
            style={{ left: `${insetBox.right}px`, top: "50%" }}
            className={cn(
              // The grandparent grid wrapper (see the outer per-bar grid
              // above) sets pointer-events-none so it never intercepts clicks
              // meant for a bar below/beside it; every interactive element
              // inside re-enables it explicitly (the inner bar div does via
              // pointer-events-auto in its own class list) — this handle,
              // living outside that div, needs its own or it renders
              // visible but is entirely unclickable.
              "pointer-events-auto absolute z-30 size-4 -translate-x-1/2 -translate-y-1/2 touch-none cursor-crosshair rounded-full border border-primary/50 bg-background text-primary opacity-0 shadow-sm transition-opacity",
              "flex items-center justify-center",
              "group-hover:opacity-100 group-focus-within:opacity-100 hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            )}
          >
            <Link2Icon className="size-2.5" aria-hidden="true" />
          </button>
        </div>
      </div>
    </>
  );
}
