import { GanttTaskBar } from "./gantt-task-bar.js";
import { GanttTaskSummary } from "./gantt-task-summary.js";
import type { ScheduledTask } from "./scheduled-task.js";
import type { GanttTimeline } from "./timeline.js";

type GanttTaskRowProps = {
  task: ScheduledTask;
  timeline: GanttTimeline;
  showTaskRail: boolean;
  railWidthRem: number;
  isMobile: boolean;
  pixelsPerDay: number;
  projectSlug: string | undefined;
  statusLabel: string;
  onOpenTask: (taskId: string) => void;
  onShowDate: (date: Date) => void;
};

export function GanttTaskRow({
  task,
  timeline,
  showTaskRail,
  railWidthRem,
  isMobile,
  pixelsPerDay,
  projectSlug,
  statusLabel,
  onOpenTask,
  onShowDate,
}: GanttTaskRowProps) {
  const openTask = () => onOpenTask(task.id);

  return (
    <div
      className="grid items-stretch border-b border-border/70"
      style={{
        gridTemplateColumns: showTaskRail
          ? `${railWidthRem}rem max-content`
          : "max-content",
      }}
    >
      {showTaskRail ? (
        <GanttTaskSummary
          task={task}
          timeline={timeline}
          projectSlug={projectSlug}
          statusLabel={statusLabel}
          onOpenTask={openTask}
          onShowDate={onShowDate}
        />
      ) : null}

      <div
        className="relative min-h-11 shrink-0 select-none"
        style={{
          minWidth: `${timeline.timelineMinWidthRem}rem`,
        }}
      >
        <GanttTaskBar
          task={task}
          timeline={timeline}
          pixelsPerDay={pixelsPerDay}
          isMobile={isMobile}
          onOpenTask={openTask}
        />
      </div>
    </div>
  );
}
