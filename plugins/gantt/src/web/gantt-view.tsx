import type { ProjectViewProps } from "@kaneo/plugin-sdk/web";
import {
  useOpenTask,
  usePreferences,
  useProject,
  useT,
  useTasks,
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
import { filterTasks } from "./filter-tasks.js";
import { GanttChart } from "./gantt-chart.js";
import { GanttMessage } from "./gantt-message.js";
import { GanttToolbar } from "./gantt-toolbar.js";
import { scheduleTasks } from "./schedule-tasks.js";
import { buildGanttTimeline } from "./timeline.js";
import { useIsMobile } from "./use-is-mobile.js";

export function GanttView({ projectId }: ProjectViewProps) {
  const t = useT();
  const { data: tasks } = useTasks(projectId);
  const { data: project } = useProject(projectId);
  const { weekStartsOn } = usePreferences();
  const openTask = useOpenTask();
  const [searchQuery, setSearchQuery] = useState("");
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
    () => scheduleTasks(tasks ?? [], columns ?? []),
    [tasks, columns],
  );

  const scheduledTasks = useMemo(
    () => filterTasks(parsedTasks, searchQuery, project?.slug ?? ""),
    [parsedTasks, project?.slug, searchQuery],
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
    todayCellRef.current?.scrollIntoView({
      behavior,
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
    <div className="flex h-full min-h-0 flex-col bg-background">
      <GanttToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
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
        <GanttMessage
          title={t("noTasksFound")}
          description={t("noTasksMatch", { query: searchQuery })}
        />
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
