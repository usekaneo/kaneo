import type { ProjectViewProps } from "@kaneo/plugin-sdk/web";
import {
  useOpenTask,
  usePreferences,
  useProject,
  useProjectView,
  useT,
} from "@kaneo/plugin-sdk/web";
import { isToday } from "date-fns";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { GanttChart } from "./gantt-chart.js";
import { GanttMessage } from "./gantt-message.js";
import { GanttToolbar } from "./gantt-toolbar.js";
import { scheduleTasks } from "./schedule-tasks.js";
import { buildGanttTimeline } from "./timeline.js";
import { useIsMobile } from "./use-is-mobile.js";

export function GanttView({ projectId }: ProjectViewProps) {
  const t = useT();
  const { tasks, allTasks } = useProjectView();
  const { data: project } = useProject(projectId);
  const { weekStartsOn } = usePreferences();
  const openTask = useOpenTask();
  const [windowStart, setWindowStart] = useState<{
    projectId: string;
    date: Date;
  } | null>(null);
  const requestedStart =
    windowStart && windowStart.projectId === projectId
      ? windowStart.date
      : null;
  const showDate = (date: Date) => setWindowStart({ projectId, date });
  const isMobile = useIsMobile();
  const [isTaskRailOpen, setIsTaskRailOpen] = useState(false);

  const dayColumnWidthRem = isMobile ? 3.125 : 2.75;
  const railWidthRem = isMobile ? 12 : 20;
  const showTaskRail = !isMobile || isTaskRailOpen;
  const todayCellRef = useRef<HTMLDivElement>(null);
  const hasCenteredOnTodayRef = useRef(false);
  const previousProjectIdRef = useRef(projectId);
  if (previousProjectIdRef.current !== projectId) {
    previousProjectIdRef.current = projectId;
    hasCenteredOnTodayRef.current = false;
  }

  useEffect(() => {
    setIsTaskRailOpen(!isMobile);
  }, [isMobile]);

  const columns = project?.columns;
  const parsedTasks = useMemo(
    () => scheduleTasks(allTasks, columns ?? []),
    [allTasks, columns],
  );

  const scheduledTasks = useMemo(
    () => scheduleTasks(tasks, columns ?? []),
    [tasks, columns],
  );

  const timeline = useMemo(
    () =>
      buildGanttTimeline(
        parsedTasks,
        weekStartsOn,
        dayColumnWidthRem,
        requestedStart,
      ),
    [parsedTasks, weekStartsOn, dayColumnWidthRem, requestedStart],
  );

  const todayInRange = useMemo(
    () => timeline?.days.some((day) => isToday(day)) ?? false,
    [timeline],
  );

  const scrollToToday = useCallback((behavior: ScrollBehavior = "smooth") => {
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    todayCellRef.current?.scrollIntoView({
      behavior: reduceMotion ? "auto" : behavior,
      inline: "center",
      block: "nearest",
    });
  }, []);

  useLayoutEffect(() => {
    if (
      hasCenteredOnTodayRef.current ||
      !todayInRange ||
      scheduledTasks.length === 0 ||
      !todayCellRef.current
    )
      return;
    hasCenteredOnTodayRef.current = true;
    scrollToToday("auto");
  }, [todayInRange, scrollToToday, projectId, scheduledTasks.length]);

  return (
    <div className="gantt:flex gantt:h-full gantt:min-h-0 gantt:flex-col gantt:bg-background">
      <GanttToolbar
        timeline={timeline}
        onShowDate={showDate}
        canJumpToToday={todayInRange && scheduledTasks.length > 0}
        onJumpToToday={() => scrollToToday()}
        showTaskRail={showTaskRail}
        onToggleTaskRail={() => setIsTaskRailOpen((current) => !current)}
      />

      {!timeline || parsedTasks.length === 0 ? (
        <GanttMessage title={t("noTasks")} description={t("noTasksSubtitle")} />
      ) : scheduledTasks.length === 0 ? (
        <GanttMessage title={t("noTasksFound")} description={t("noMatches")} />
      ) : (
        <GanttChart
          timeline={timeline}
          tasks={scheduledTasks}
          columns={columns ?? []}
          projectSlug={project?.slug}
          showTaskRail={showTaskRail}
          isMobile={isMobile}
          railWidthRem={railWidthRem}
          todayCellRef={todayCellRef}
          onOpenTask={openTask}
          onShowDate={showDate}
        />
      )}
    </div>
  );
}
