import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import type { GanttBarEmphasis } from "./timeline";
import { getBarGridColumns } from "./timeline";

type GanttSummaryTaskBarProps = {
  title: string;
  scheduleStart: Date;
  scheduleEnd: Date;
  timeline: {
    days: Date[];
    rangeStart: Date;
    gridTemplateColumns: string;
  };
  emphasis?: GanttBarEmphasis;
  /** Whether this task sits on the currently-highlighted critical path (see
   * gantt-critical-path.ts and GanttTaskBar's own isCritical prop). */
  isCritical?: boolean;
  /** Notified on hover/focus, same as GanttTaskBar, so hovering the summary
   * bar highlights its dependency lines too. */
  onHoverChange?: (hovering: boolean) => void;
  onOpenTask: () => void;
};

// A parent task's row (see gantt-hierarchy.ts) renders as a summary bracket
// — a slim horizontal band with a downward tick at each end — rather than
// the usual filled bar, so it reads at a glance as "the span of its
// children" rather than a task with its own progress fill/resize handles.
// It's click-to-open only: dragging or resizing a rollup that's entirely
// derived from its children's own dates would have nothing real to persist.
export function GanttSummaryTaskBar({
  title,
  scheduleStart,
  scheduleEnd,
  timeline,
  emphasis = "normal",
  isCritical = false,
  onHoverChange,
  onOpenTask,
}: GanttSummaryTaskBarProps) {
  const { t } = useTranslation();
  const trackCount = timeline.days.length;
  const { barInView, lineStart, lineEnd } = getBarGridColumns(
    scheduleStart,
    scheduleEnd,
    timeline.rangeStart,
    trackCount,
  );

  if (!barInView) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] grid items-center"
      style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover/focus tracking drives dependency-line highlighting, matching GanttTaskBar; the actual interactive control is the button nested below */}
      <div
        style={{ gridColumn: `${lineStart} / ${lineEnd}` }}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
        onFocus={() => onHoverChange?.(true)}
        onBlur={() => onHoverChange?.(false)}
        className="pointer-events-auto relative mx-1 flex min-h-[44px] items-center sm:h-11 sm:min-h-0"
      >
        <button
          type="button"
          aria-label={t("tasks:gantt.summaryAriaLabel", { title })}
          title={title}
          onClick={onOpenTask}
          className={cn(
            "relative h-3 w-full touch-manipulation rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1",
            // Critical-path accent (see GanttTaskBar's own isCritical prop
            // for why this is `outline`, not a color swap).
            isCritical && "outline outline-2 outline-offset-2 outline-warning",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-sm bg-foreground/70 dark:bg-foreground/60",
              emphasis === "highlighted" &&
                "bg-primary ring-2 ring-primary/40",
              emphasis === "dimmed" && "opacity-35",
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              "absolute left-0 top-0 h-full w-1 rounded-sm bg-foreground/70 dark:bg-foreground/60",
              emphasis === "highlighted" && "bg-primary",
              emphasis === "dimmed" && "opacity-35",
            )}
          />
          <span
            aria-hidden="true"
            className={cn(
              "absolute right-0 top-0 h-full w-1 rounded-sm bg-foreground/70 dark:bg-foreground/60",
              emphasis === "highlighted" && "bg-primary",
              emphasis === "dimmed" && "opacity-35",
            )}
          />
        </button>
      </div>
    </div>
  );
}
