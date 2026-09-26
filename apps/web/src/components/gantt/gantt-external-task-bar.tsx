import { useTranslation } from "react-i18next";
import { cn } from "@/lib/cn";
import { getBarGridColumns } from "./timeline";

type GanttBarEmphasis = "normal" | "highlighted" | "dimmed";

export type ExternalGanttTask = {
  id: string;
  title: string;
  number: number | null;
  projectName: string;
  projectSlug: string;
  scheduleStart: Date;
  scheduleEnd: Date;
};

type GanttExternalTaskBarProps = {
  task: ExternalGanttTask;
  timeline: {
    days: Date[];
    rangeStart: Date;
    gridTemplateColumns: string;
  };
  emphasis?: GanttBarEmphasis;
  /** Notified on hover/focus, same as GanttTaskBar, so hovering an external
   * bar highlights its dependency lines too. */
  onHoverChange?: (hovering: boolean) => void;
};

// A related task that lives in a different project: shown so its dependency
// line has somewhere to land, but not draggable/resizable and not openable
// as a task in *this* project's board — the task rail beside it renders a
// matching read-only summary instead of the usual open-task button.
export function GanttExternalTaskBar({
  task,
  timeline,
  emphasis = "normal",
  onHoverChange,
}: GanttExternalTaskBarProps) {
  const { t } = useTranslation();
  const trackCount = timeline.days.length;
  const { barInView, lineStart, lineEnd } = getBarGridColumns(
    task.scheduleStart,
    task.scheduleEnd,
    timeline.rangeStart,
    trackCount,
  );

  if (!barInView) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] grid items-center"
      style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
    >
      {/* biome-ignore lint/a11y/noStaticElementInteractions: hover/focus tracking drives dependency-line highlighting, matching GanttTaskBar; there is nothing to activate here since the task isn't editable from this board. */}
      <div
        data-gantt-external-bar=""
        style={{ gridColumn: `${lineStart} / ${lineEnd}` }}
        onMouseEnter={() => onHoverChange?.(true)}
        onMouseLeave={() => onHoverChange?.(false)}
        className={cn(
          "pointer-events-auto relative mx-1 flex min-h-[44px] min-w-0 cursor-default items-center gap-1.5 overflow-hidden rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 px-2 text-left text-sm font-medium leading-none text-muted-foreground shadow-sm transition-opacity sm:h-11 sm:min-h-0",
          emphasis === "highlighted" &&
            "border-primary/50 ring-2 ring-primary/30",
          emphasis === "dimmed" && "opacity-35",
        )}
        title={t("tasks:gantt.externalTaskTitle", {
          title: task.title,
          projectName: task.projectName,
        })}
      >
        <span className="shrink-0 truncate rounded-full bg-secondary/60 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
          {task.projectSlug}
          {task.number ? `-${task.number}` : ""}
        </span>
        <span className="truncate">{task.title}</span>
      </div>
    </div>
  );
}
