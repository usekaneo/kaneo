import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  startOfWeek,
  subDays,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import { GanttTaskBar } from "@/components/gantt/gantt-task-bar";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/cn";
import { getStatusLabel } from "@/lib/i18n/domain";
import { useUserPreferencesStore } from "@/store/user-preferences";

type GanttSearchParams = {
  taskId?: string;
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/gantt",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): GanttSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function parseTaskDate(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project } = useGetTasks(projectId);
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  const [searchQuery, setSearchQuery] = useState("");
  const isMobile = useIsMobile();
  const [isTaskRailOpen, setIsTaskRailOpen] = useState(false);

  // Wider day columns on small screens so dragging and reading dates is easier.
  const dayColumnWidthRem = isMobile ? 3.125 : 2.75;
  const taskColumnWidthRem = isMobile ? 12 : 14;
  const showTaskRail = !isMobile || isTaskRailOpen;
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const [pixelsPerDay, setPixelsPerDay] = useState(44);
  const todayCellRef = useRef<HTMLDivElement>(null);
  // Only auto-scroll once per visit to the view: re-running on every timeline
  // recalculation (e.g. a browser resize crossing the mobile breakpoint) would
  // yank the grid back to today out from under someone who deliberately
  // scrolled elsewhere.
  const hasCenteredOnTodayRef = useRef(false);
  // The Gantt project selector can swap `projectId` without unmounting this
  // route, so the one-time guard above has to be re-armed for the newly
  // selected project. Resetting it here (during render, comparing against the
  // previous projectId) rather than in an effect means it's already cleared
  // by the time the auto-center layout effect below runs for this project,
  // instead of one render later.
  const previousProjectIdRef = useRef(projectId);
  if (previousProjectIdRef.current !== projectId) {
    previousProjectIdRef.current = projectId;
    hasCenteredOnTodayRef.current = false;
  }

  useEffect(() => {
    if (!isMobile) {
      setIsTaskRailOpen(true);
      return;
    }

    setIsTaskRailOpen(false);
  }, [isMobile]);

  const allTasks = useMemo(
    () => [
      ...(project?.columns.flatMap((column) => column.tasks) ?? []),
      ...(project?.plannedTasks ?? []),
    ],
    [project],
  );

  const parsedTasks = useMemo(() => {
    return allTasks
      .map((task) => {
        const parsedStart =
          parseTaskDate(task.startDate) ?? parseTaskDate(task.dueDate);
        const parsedEnd =
          parseTaskDate(task.dueDate) ?? parseTaskDate(task.startDate);

        if (!parsedStart || !parsedEnd) return null;

        const start = parsedStart <= parsedEnd ? parsedStart : parsedEnd;
        const end = parsedEnd >= parsedStart ? parsedEnd : parsedStart;

        return {
          ...task,
          scheduleStart: start,
          scheduleEnd: end,
        };
      })
      .filter((task): task is NonNullable<typeof task> => task !== null)
      .sort(
        (left, right) =>
          left.scheduleStart.getTime() - right.scheduleStart.getTime(),
      );
  }, [allTasks]);

  const scheduledTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    if (!normalizedQuery) return parsedTasks;

    return parsedTasks.filter((task) => {
      return (
        task.title.toLowerCase().includes(normalizedQuery) ||
        `${project?.slug ?? ""}-${task.number ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery) ||
        task.status.toLowerCase().includes(normalizedQuery)
      );
    });
  }, [parsedTasks, project?.slug, searchQuery]);

  const timeline = useMemo(() => {
    if (parsedTasks.length === 0) return null;

    const earliest = parsedTasks.reduce(
      (current, task) =>
        task.scheduleStart < current ? task.scheduleStart : current,
      parsedTasks[0].scheduleStart,
    );
    const latest = parsedTasks.reduce(
      (current, task) =>
        task.scheduleEnd > current ? task.scheduleEnd : current,
      parsedTasks[0].scheduleEnd,
    );

    // Week-aligned bounds around task dates, then pad with extra days so bars can
    // be resized or moved past the current last task without running out of grid.
    const weekStart = startOfWeek(earliest, { weekStartsOn });
    const weekEnd = endOfWeek(latest, { weekStartsOn });
    const rangeStart = subDays(weekStart, 7);
    const rangeEnd = addDays(weekEnd, 28);

    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    return {
      days,
      rangeStart,
      gridTemplateColumns: `repeat(${days.length}, minmax(${dayColumnWidthRem}rem, ${dayColumnWidthRem}rem))`,
      timelineMinWidthRem: days.length * dayColumnWidthRem,
    };
  }, [parsedTasks, dayColumnWidthRem, weekStartsOn]);

  // Whether "today" actually falls inside the computed date range. A project
  // made up entirely of past or far-future tasks has no "today" column to
  // jump to, so the button below is disabled in that case instead of doing
  // nothing silently.
  const todayInRange = useMemo(
    () => timeline?.days.some((day) => isToday(day)) ?? false,
    [timeline],
  );

  // The task rail is `position: sticky; left: 0`, so it stays pinned over the
  // left edge of the scroll container's viewport rather than scrolling away
  // with the timeline underneath it. `scrollIntoView({ inline: "center" })`
  // has no way to know that, and centers the target against the *whole*
  // viewport width, landing today roughly half the rail's width left of
  // where it visually reads as centered. `scroll-padding-left` tells the
  // browser's own scroll-alignment math to treat the rail's width as inset
  // from the viewport, so "center" (and any future "start"/"end" alignment)
  // resolves against the space actually visible next to it.
  const scrollPaddingLeftRem = showTaskRail
    ? isMobile
      ? taskColumnWidthRem
      : 20
    : 0;

  const scrollToToday = useCallback((behavior: ScrollBehavior = "smooth") => {
    todayCellRef.current?.scrollIntoView({
      behavior,
      inline: "center",
      block: "nearest",
    });
  }, []);

  useLayoutEffect(() => {
    const element = timelineTrackRef.current;
    if (!element || !timeline) return;

    const update = () => {
      const count = timeline.days.length;
      if (count <= 0) return;
      setPixelsPerDay(element.clientWidth / count);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [timeline]);

  // Center the view on today the first time it becomes available, so opening
  // the Gantt chart on a long-running project doesn't drop you at the start
  // of the timeline with today scrolled off-screen. `projectId` is listed as
  // a dependency (even though the effect body doesn't use it directly)
  // because switching projects can leave `todayInRange` unchanged (true on
  // both the old and new project) while still resetting the one-time guard
  // above during render — without `projectId` here, React would bail out of
  // re-running this effect since neither `todayInRange` nor `scrollToToday`
  // actually changed value, and the newly selected project would never get
  // its auto-center.
  // biome-ignore lint/correctness/useExhaustiveDependencies: projectId is intentionally listed to force a re-run on project switch; see comment above.
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
    <ProjectLayout
      projectId={projectId}
      workspaceId={workspaceId}
      activeView="gantt"
    >
      <PageTitle
        title={t("tasks:gantt.pageTitle", { name: project?.name })}
        hideAppName
      />
      <div className="flex h-full min-h-0 flex-col bg-background">
        <div className="border-b border-border/80 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-sm font-semibold text-foreground">
                {t("tasks:gantt.title")}
              </h1>
            </div>

            <div className="relative w-full max-w-sm">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder={t("tasks:gantt.searchPlaceholder")}
                className="h-9 min-h-11 touch-manipulation sm:h-8 sm:min-h-0 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-xs"
              />
            </div>

            <Button
              variant="outline"
              size="xs"
              className="min-h-11 touch-manipulation sm:min-h-0"
              onClick={() => scrollToToday()}
              disabled={!todayInRange || scheduledTasks.length === 0}
            >
              <Calendar className="size-3.5" />
              {t("tasks:gantt.jumpToToday")}
            </Button>

            <Button
              variant="outline"
              size="xs"
              className="min-h-11 touch-manipulation sm:hidden"
              onClick={() => setIsTaskRailOpen((current) => !current)}
            >
              {showTaskRail ? (
                <ChevronLeft className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              {showTaskRail
                ? t("tasks:gantt.hideTasks")
                : t("tasks:gantt.showTasks")}
            </Button>
          </div>
        </div>

        {!timeline || parsedTasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <h2 className="text-sm font-semibold text-foreground">
                {t("tasks:gantt.noTasks")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("tasks:gantt.noTasksSubtitle")}
              </p>
            </div>
          </div>
        ) : scheduledTasks.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="max-w-sm text-center">
              <h2 className="text-sm font-semibold text-foreground">
                {t("tasks:gantt.noTasksFound")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("tasks:gantt.noTasksMatch", { query: searchQuery })}
              </p>
            </div>
          </div>
        ) : (
          <div
            data-testid="gantt-scroll-container"
            className="min-h-0 flex-1 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
            style={{ scrollPaddingLeft: `${scrollPaddingLeftRem}rem` }}
          >
            <div className="relative min-w-max touch-pan-x touch-pan-y">
              <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur">
                {showTaskRail ? (
                  <div
                    className="sticky left-0 z-30 shrink-0 border-r border-border bg-background px-2 py-2.5 sm:w-80 sm:px-4 sm:py-3"
                    style={{
                      width: isMobile ? `${taskColumnWidthRem}rem` : undefined,
                    }}
                  >
                    <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {t("tasks:gantt.taskHeader")}
                    </p>
                  </div>
                ) : null}
                <div
                  className="grid shrink-0"
                  style={{
                    gridTemplateColumns: timeline.gridTemplateColumns,
                    minWidth: `${timeline.timelineMinWidthRem}rem`,
                  }}
                >
                  {timeline.days.map((day, index) => {
                    const showMonth =
                      index === 0 ||
                      !isSameMonth(day, timeline.days[index - 1] ?? day);

                    const isCurrentDay = isToday(day);

                    return (
                      <div
                        key={day.toISOString()}
                        ref={isCurrentDay ? todayCellRef : undefined}
                        className={cn(
                          "border-r border-border/70 px-0.5 py-2 text-center sm:px-1",
                          isWeekend(day) && "bg-muted/25",
                        )}
                      >
                        <div className="h-4 text-[10px] font-medium text-muted-foreground">
                          {showMonth ? format(day, "MMM") : ""}
                        </div>
                        <div
                          className={cn(
                            "mx-auto flex size-6 items-center justify-center rounded-full text-xs font-medium",
                            isCurrentDay &&
                              "bg-primary text-primary-foreground",
                          )}
                        >
                          {format(day, "d")}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div
                  ref={timelineTrackRef}
                  className="absolute inset-y-0 z-0 grid"
                  style={{
                    left: showTaskRail
                      ? isMobile
                        ? `${taskColumnWidthRem}rem`
                        : "20rem"
                      : "0rem",
                    gridTemplateColumns: timeline.gridTemplateColumns,
                    width: `${timeline.timelineMinWidthRem}rem`,
                  }}
                >
                  {timeline.days.map((day) => (
                    <div
                      key={`bg-line-${day.toISOString()}`}
                      className={cn(
                        "h-full min-h-0 border-r border-border/60",
                        isWeekend(day) && "bg-muted/25",
                      )}
                    />
                  ))}
                </div>

                <div className="relative z-10 flex flex-col">
                  {scheduledTasks.map((task) => {
                    return (
                      <div
                        key={task.id}
                        className="grid items-stretch border-b border-border/70"
                        style={{
                          gridTemplateColumns: showTaskRail
                            ? isMobile
                              ? `${taskColumnWidthRem}rem max-content`
                              : "20rem max-content"
                            : "max-content",
                        }}
                      >
                        {showTaskRail ? (
                          <div className="sticky left-0 z-[11] h-full border-r border-border bg-background">
                            <button
                              type="button"
                              className="flex min-h-[44px] w-full min-w-0 flex-col items-start justify-center gap-0.5 px-2 py-2 text-left transition-colors hover:bg-muted sm:min-h-0 sm:px-3 sm:py-1.5"
                              onClick={() =>
                                navigate({
                                  to: ".",
                                  search: { taskId: task.id },
                                  replace: true,
                                })
                              }
                            >
                              <div className="flex w-full items-center gap-1.5">
                                <span className="max-w-[7rem] truncate rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-secondary-foreground sm:max-w-none">
                                  {getStatusLabel(task.status)}
                                </span>
                                <span className="truncate text-[10px] text-muted-foreground">
                                  {project?.slug}-{task.number}
                                </span>
                              </div>
                              <p className="w-full line-clamp-1 text-xs font-medium leading-tight text-foreground">
                                {task.title}
                              </p>
                              <p className="w-full truncate text-[11px] leading-tight text-muted-foreground">
                                {format(task.scheduleStart, "MMM d")} -{" "}
                                {format(task.scheduleEnd, "MMM d")}
                                {task.assigneeName
                                  ? ` • ${task.assigneeName}`
                                  : ""}
                              </p>
                            </button>
                          </div>
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
                            onOpenTask={() =>
                              navigate({
                                to: ".",
                                search: { taskId: task.id },
                                replace: true,
                              })
                            }
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        <TaskDetailsSheet
          taskId={taskId}
          projectId={projectId}
          workspaceId={workspaceId}
          onClose={() =>
            navigate({
              to: ".",
              search: {},
              replace: true,
            })
          }
        />
      </div>
    </ProjectLayout>
  );
}
