"use client";

import {
  addDays,
  differenceInCalendarDays,
  eachDayOfInterval,
  format,
  isSameMonth,
  isToday,
  isWeekend,
  parseISO,
  subDays,
} from "date-fns";
import {
  CalendarDays,
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  SearchIcon,
  SquareKanban,
  SquircleDashed,
} from "lucide-react";
import type * as React from "react";
import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import BoardToolbar from "@/components/project-board-toolbar";
import { PrivateListView } from "@/components/project-private-list-view";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { useTaskFilters } from "@/hooks/use-task-filters";
import { cn } from "@/lib/utils";
import type Task from "@/types/task";
import messages from "../../../../../i18n/en-US.json";
import { getAssignedTasks, indexTasks } from "./assigned-tasks";
import { PreviewBoard } from "./board-view";
import { PreviewCalendar } from "./calendar-view";
import { HomeView } from "./home-view";
import { InboxView } from "./inbox-view";
import {
  CURRENT_USER,
  MOCK_PROJECTS,
  MOCK_TASK_DETAILS,
  MOCK_USERS,
  MOCK_WORKSPACE,
  MOCK_WORKSPACE_LABELS,
} from "./mock-data";
import { MOCK_NOTIFICATIONS } from "./mock-inbox";
import { MyTasksView } from "./my-tasks-view";
import { type PreviewPage, PreviewSidebar } from "./sidebar";
import { PreviewTaskDetailsPanel } from "./task-details";

const PREVIEW_W = 1400;
const PREVIEW_H = 860;

export type PreviewView = "board" | "list" | "calendar" | "gantt";
export type PreviewMode = PreviewView | PreviewPage;

const PAGES: readonly PreviewMode[] = ["home", "inbox", "my-tasks"];

function isPage(mode: PreviewMode): mode is PreviewPage {
  return PAGES.includes(mode);
}

type ScheduledTask = Task & {
  scheduleStart: Date;
  scheduleEnd: Date;
};

function parseTaskDate(value: string | null) {
  if (!value) return null;
  const parsed = parseISO(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getBarGridColumns(
  scheduleStart: Date,
  scheduleEnd: Date,
  rangeStart: Date,
  trackCount: number,
): { barInView: boolean; lineStart: number; lineEnd: number } {
  const startIndex = differenceInCalendarDays(scheduleStart, rangeStart);
  const endIndex = differenceInCalendarDays(scheduleEnd, rangeStart);
  const barInView = endIndex >= 0 && startIndex < trackCount && trackCount > 0;
  if (!barInView) return { barInView: false, lineStart: 1, lineEnd: 1 };

  const lineStart = Math.max(1, Math.min(startIndex + 1, trackCount));
  const lineEnd = Math.max(
    lineStart + 1,
    Math.min(endIndex + 2, trackCount + 1),
  );

  return { barInView: true, lineStart, lineEnd };
}

function MockGanttTaskBar({
  task,
  timeline,
  onTaskClick,
}: {
  task: ScheduledTask;
  onTaskClick: (task: Task) => void;
  timeline: {
    days: Date[];
    rangeStart: Date;
    gridTemplateColumns: string;
  };
}) {
  const { barInView, lineStart, lineEnd } = getBarGridColumns(
    task.scheduleStart,
    task.scheduleEnd,
    timeline.rangeStart,
    timeline.days.length,
  );

  if (!barInView || lineEnd <= lineStart) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] grid items-center"
      style={{ gridTemplateColumns: timeline.gridTemplateColumns }}
    >
      <div
        style={{ gridColumn: `${lineStart} / ${lineEnd}` }}
        className="group pointer-events-auto relative mx-1 flex h-11 min-w-0 items-stretch overflow-hidden rounded-md border border-primary/25 bg-background text-left text-sm font-medium leading-none text-foreground shadow-sm transition-colors hover:border-primary/40"
      >
        <div className="relative z-20 w-2 shrink-0 border-r border-primary/15 bg-primary/8" />
        <button
          type="button"
          onClick={() => onTaskClick(task)}
          className="relative z-10 min-w-0 flex-1 cursor-pointer overflow-hidden px-2.5 text-left active:cursor-grabbing"
        >
          <div className="absolute inset-0 z-0 bg-primary/12 transition-colors group-hover:bg-primary/18" />
          <span className="relative z-10 block truncate">{task.title}</span>
        </button>
        <div className="relative z-20 w-2 shrink-0 border-l border-primary/15 bg-primary/8" />
      </div>
    </div>
  );
}

function MockGanttView({
  project,
  onTaskClick,
}: {
  project: (typeof MOCK_PROJECTS)[number];
  onTaskClick: (task: Task) => void;
}) {
  const [search, setSearch] = useState("");
  const [rangeStart, setRangeStart] = useState(() => subDays(new Date(), 4));
  const scrollArea = useRef<HTMLDivElement>(null);
  const visibleTasks = (tasks: ScheduledTask[]) =>
    tasks.filter((task) =>
      `${project.slug}-${task.number} ${task.title}`
        .toLowerCase()
        .includes(search.toLowerCase()),
    );
  const dayColumnWidthRem = 2.75;
  const taskColumnWidthRem = 20;

  const statusNames = useMemo(
    () => new Map(project.columns.map((column) => [column.id, column.name])),
    [project.columns],
  );

  const parsedTasks = useMemo(() => {
    return project.columns
      .flatMap((column) => column.tasks)
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
      .filter((task): task is ScheduledTask => task !== null)
      .sort(
        (left, right) =>
          left.scheduleStart.getTime() - right.scheduleStart.getTime(),
      );
  }, [project.columns]);

  const timeline = useMemo(() => {
    const rangeEnd = addDays(rangeStart, 41);
    const days = eachDayOfInterval({ start: rangeStart, end: rangeEnd });

    return {
      days,
      rangeStart,
      gridTemplateColumns: `repeat(${days.length}, minmax(${dayColumnWidthRem}rem, ${dayColumnWidthRem}rem))`,
      timelineMinWidthRem: days.length * dayColumnWidthRem,
    };
  }, [rangeStart]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="border-b border-border/80 px-4 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1">
            <h2 className="text-sm font-semibold text-foreground">
              {messages.tasks.gantt.title}
            </h2>
          </div>

          <div className="relative w-full max-w-52">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label={messages.tasks.gantt.searchPlaceholder}
              placeholder={messages.tasks.gantt.searchPlaceholder}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="h-8 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-xs"
            />
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="icon-xs"
              aria-label={messages.tasks.gantt.previousPeriod}
              onClick={() => setRangeStart((date) => subDays(date, 28))}
            >
              <ChevronLeft />
            </Button>
            <input
              type="date"
              aria-label={messages.tasks.gantt.periodStart}
              value={format(rangeStart, "yyyy-MM-dd")}
              onChange={(event) => {
                const date = parseTaskDate(event.target.value);
                if (date) setRangeStart(date);
              }}
              className="h-8 rounded-md border border-border bg-background px-2 text-xs"
            />
            <Button
              variant="outline"
              size="icon-xs"
              aria-label={messages.tasks.gantt.nextPeriod}
              onClick={() => setRangeStart((date) => addDays(date, 28))}
            >
              <ChevronRight />
            </Button>
            <Button
              variant="outline"
              size="xs"
              onClick={() => {
                setRangeStart(subDays(new Date(), 4));
                if (scrollArea.current) scrollArea.current.scrollLeft = 0;
              }}
            >
              <CalendarDays className="size-3.5" />
              {messages.tasks.gantt.jumpToToday}
            </Button>
          </div>
        </div>
      </div>

      <div
        ref={scrollArea}
        className="min-h-0 flex-1 overflow-auto overscroll-x-contain"
      >
        <div className="relative min-w-max">
          <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur">
            <div
              className="sticky left-0 z-30 shrink-0 border-r border-border bg-background px-4 py-3"
              style={{ width: `${taskColumnWidthRem}rem` }}
            >
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Task
              </p>
            </div>
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

                return (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "border-r border-border/70 px-1 py-2 text-center",
                      isWeekend(day) && "bg-muted/25",
                    )}
                  >
                    <div className="h-4 text-[10px] font-medium text-muted-foreground">
                      {showMonth ? format(day, "MMM") : ""}
                    </div>
                    <div
                      className={cn(
                        "mx-auto flex size-6 items-center justify-center rounded-full text-xs font-medium",
                        isToday(day) && "bg-primary text-primary-foreground",
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
              className="absolute inset-y-0 z-0 grid"
              style={{
                left: `${taskColumnWidthRem}rem`,
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
              {visibleTasks(parsedTasks).length === 0 && (
                <p className="sticky left-0 w-80 p-4 text-sm text-muted-foreground">
                  {messages.tasks.gantt.noTasksFound}
                </p>
              )}
              {visibleTasks(parsedTasks).map((task) => (
                <div
                  key={task.id}
                  className="grid items-stretch border-b border-border/70"
                  style={{
                    gridTemplateColumns: `${taskColumnWidthRem}rem max-content`,
                  }}
                >
                  <div className="sticky left-0 z-[11] h-full border-r border-border bg-background">
                    <button
                      type="button"
                      onClick={() => onTaskClick(task)}
                      className="flex w-full min-w-0 flex-col items-start justify-center gap-0.5 px-3 py-1.5 text-left transition-colors hover:bg-muted"
                    >
                      <div className="flex w-full items-center gap-1.5">
                        <span className="truncate rounded-full bg-secondary px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-secondary-foreground">
                          {statusNames.get(task.status) ?? task.status}
                        </span>
                        <span className="truncate text-[10px] text-muted-foreground">
                          {project.slug}-{task.number}
                        </span>
                      </div>
                      <p className="w-full line-clamp-1 text-xs font-medium leading-tight text-foreground">
                        {task.title}
                      </p>
                      <p className="w-full truncate text-[11px] leading-tight text-muted-foreground">
                        {format(task.scheduleStart, "MMM d")} -{" "}
                        {format(task.scheduleEnd, "MMM d")}
                        {task.assigneeName ? ` • ${task.assigneeName}` : ""}
                      </p>
                    </button>
                  </div>

                  <div
                    className="relative h-[50px] shrink-0 select-none"
                    style={{ minWidth: `${timeline.timelineMinWidthRem}rem` }}
                  >
                    <MockGanttTaskBar
                      task={task}
                      timeline={timeline}
                      onTaskClick={onTaskClick}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// AppPreview
// ─────────────────────────────────────────────────────────────────────────────
export type AppPreviewHandle = {
  moveTask: (taskId: string, status: string) => void;
};

export function AppPreview({
  mode,
  onModeChange,
  tourRef,
}: {
  mode?: PreviewMode;
  onModeChange?: (mode: PreviewMode) => void;
  tourRef?: React.Ref<AppPreviewHandle>;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [taskDetails, setTaskDetails] = useState(MOCK_TASK_DETAILS);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const taskTrigger = useRef<HTMLElement | null>(null);
  const previousScrollLeft = useRef(0);
  const openTask = (task: Task) => {
    taskTrigger.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    previousScrollLeft.current = wrapperRef.current?.scrollLeft ?? 0;
    setSelectedTaskId(task.id);
    if (wrapperRef.current && wrapperRef.current.clientWidth < 768) {
      wrapperRef.current.scrollLeft = wrapperRef.current.scrollWidth;
    }
  };
  const closeTask = () => {
    setSelectedTaskId(null);
    if (wrapperRef.current)
      wrapperRef.current.scrollLeft = previousScrollLeft.current;
    taskTrigger.current?.focus({ preventScroll: true });
  };

  const [activeProjectId, setActiveProjectId] = useState(MOCK_PROJECTS[0].id);
  const [selectedViewMode, setSelectedViewMode] =
    useState<PreviewMode>("board");
  const setViewMode = useCallback(
    (next: PreviewMode) => {
      setSelectedTaskId(null);
      setSelectedViewMode(next);
      onModeChange?.(next);
    },
    [onModeChange],
  );
  const viewMode = mode ?? selectedViewMode;
  const page = isPage(viewMode) ? viewMode : null;
  // The project view to return to after visiting a workspace page.
  const lastView = useRef<PreviewView>("board");
  const view = isPage(viewMode) ? lastView.current : viewMode;
  const previousView = useRef(viewMode);
  useEffect(() => {
    if (!isPage(viewMode)) lastView.current = viewMode;
    if (previousView.current !== viewMode) {
      setSelectedTaskId(null);
      previousView.current = viewMode;
    }
  }, [viewMode]);

  const [taskStatuses, setTaskStatuses] = useState<Record<string, string>>({});
  useImperativeHandle(
    tourRef,
    () => ({
      moveTask: (taskId, status) =>
        setTaskStatuses((current) => ({ ...current, [taskId]: status })),
    }),
    [],
  );
  const projects = useMemo(
    () =>
      MOCK_PROJECTS.map((project) => {
        const tasks = project.columns
          .flatMap((column) => column.tasks)
          .map((task) => ({
            ...task,
            status: taskStatuses[task.id] ?? task.status,
          }));
        return {
          ...project,
          columns: project.columns.map((column) => ({
            ...column,
            tasks: tasks.filter((task) => task.status === column.id),
          })),
        };
      }),
    [taskStatuses],
  );
  const activeProject =
    projects.find((project) => project.id === activeProjectId) ?? projects[0];
  const tasks = useMemo(() => indexTasks(projects), [projects]);
  const assignedTasks = useMemo(
    () => getAssignedTasks(projects, CURRENT_USER.id),
    [projects],
  );
  const [notifications, setNotifications] = useState(MOCK_NOTIFICATIONS);
  const unreadCount = notifications.filter(
    (notification) => !notification.isRead,
  ).length;

  const selectedTask = selectedTaskId ? tasks.get(selectedTaskId) : undefined;

  const {
    filters,
    filteredProject,
    updateFilter,
    updateLabelFilter,
    clearFilters,
    hasActiveFilters,
  } = useTaskFilters(activeProject, activeProjectId);

  const handleProjectSelect = useCallback(
    (id: string) => {
      setSelectedTaskId(null);
      setActiveProjectId(id);
      if (page) setViewMode(lastView.current);
    },
    [page, setViewMode],
  );

  const setBoardToolbarMode = useCallback(
    (mode: "board" | "list") => {
      setViewMode(mode);
    },
    [setViewMode],
  );

  // Scale preview to fill the container width; boost on mobile for legibility
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) {
        const boost = w < 768 ? 2.5 : 1;
        setScale((w / PREVIEW_W) * boost);
      }
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="relative w-full overflow-x-auto md:overflow-x-hidden [-webkit-overflow-scrolling:touch]"
      style={{ height: PREVIEW_H * scale }}
    >
      <div
        style={{
          width: PREVIEW_W,
          height: PREVIEW_H,
          transform: `scale(${scale}) translateZ(0)`,
          transformOrigin: "top left",
          willChange: "transform",
          backfaceVisibility: "hidden" as const,
          WebkitFontSmoothing: "subpixel-antialiased",
        }}
        className="absolute top-0 left-0 overflow-hidden rounded-xl border border-border/70 bg-background shadow-2xl ring-1 ring-black/5"
      >
        <SidebarProvider
          defaultOpen
          style={
            { "--sidebar-width": "15rem", minHeight: 0 } as React.CSSProperties
          }
          className="h-full"
        >
          <PreviewSidebar
            projects={projects}
            activePage={page}
            activeProjectId={activeProjectId}
            unreadCount={unreadCount}
            assignedCount={assignedTasks.length}
            onPageSelect={setViewMode}
            onProjectSelect={handleProjectSelect}
          />

          <SidebarInset className="m-2 flex flex-1 flex-col overflow-hidden rounded-xl border border-border/80 bg-background shadow-sm/5">
            {page === "home" ? (
              <HomeView
                projects={projects}
                assignedTasks={assignedTasks}
                tasks={tasks}
                onTaskClick={openTask}
                onProjectSelect={handleProjectSelect}
                onViewAllTasks={() => setViewMode("my-tasks")}
              />
            ) : page === "inbox" ? (
              <InboxView
                notifications={notifications}
                onNotificationsChange={setNotifications}
                tasks={tasks}
                onOpenTask={openTask}
              />
            ) : page === "my-tasks" ? (
              <MyTasksView tasks={assignedTasks} onTaskClick={openTask} />
            ) : (
              <>
                {/* ── Project header (matches project-layout.tsx) ───────────── */}
                <header className="h-11 flex shrink-0 items-center gap-2 border-b border-border/80 bg-card px-2">
                  <div className="flex w-full items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-2">
                      {/* Breadcrumb */}
                      <div className="flex min-w-0 items-center gap-1">
                        <span className="text-sm text-muted-foreground truncate">
                          {MOCK_WORKSPACE.name}
                        </span>
                        <span className="text-muted-foreground/70 text-xs">
                          /
                        </span>
                        <span className="text-sm font-medium truncate">
                          {activeProject.name}
                        </span>
                      </div>

                      {/* View switcher */}
                      <div className="h-8 items-center gap-0.5 rounded-lg border border-border/80 bg-background p-0.5 inline-flex">
                        <Button
                          variant={view === "list" ? "secondary" : "ghost"}
                          size="xs"
                          data-tour-target="list"
                          onClick={() => setViewMode("list")}
                          className={cn(
                            "h-6 gap-1.5 rounded-md px-2 text-xs",
                            view !== "list" && "text-muted-foreground",
                          )}
                        >
                          <SquircleDashed className="size-3.5" />
                          Backlog
                        </Button>
                        <Button
                          variant={view === "board" ? "secondary" : "ghost"}
                          size="xs"
                          data-tour-target="board"
                          onClick={() => setViewMode("board")}
                          className={cn(
                            "h-6 gap-1.5 rounded-md px-2 text-xs",
                            view !== "board" && "text-muted-foreground",
                          )}
                        >
                          <SquareKanban className="size-3.5" />
                          Board
                        </Button>
                        <Button
                          variant={view === "calendar" ? "secondary" : "ghost"}
                          size="xs"
                          data-tour-target="calendar"
                          onClick={() => setViewMode("calendar")}
                          className={cn(
                            "h-6 gap-1.5 rounded-md px-2 text-xs",
                            view !== "calendar" && "text-muted-foreground",
                          )}
                        >
                          <CalendarRange className="size-3.5" />
                          {messages.tasks.calendar.title}
                        </Button>
                        <Button
                          variant={view === "gantt" ? "secondary" : "ghost"}
                          size="xs"
                          data-tour-target="gantt"
                          onClick={() => setViewMode("gantt")}
                          className={cn(
                            "h-6 gap-1.5 rounded-md px-2 text-xs",
                            view !== "gantt" && "text-muted-foreground",
                          )}
                        >
                          <CalendarDays className="size-3.5" />
                          Gantt
                        </Button>
                      </div>
                    </div>
                  </div>
                </header>

                {/* ── Board Toolbar ─────────────────────────────────────────── */}
                {view === "board" || view === "list" ? (
                  <BoardToolbar
                    project={activeProject}
                    filters={filters}
                    updateFilter={updateFilter}
                    updateLabelFilter={updateLabelFilter}
                    clearFilters={clearFilters}
                    hasActiveFilters={hasActiveFilters}
                    users={MOCK_USERS}
                    workspaceLabels={MOCK_WORKSPACE_LABELS}
                    viewMode={view}
                    setViewMode={setBoardToolbarMode}
                  />
                ) : null}

                {/* ── View content ─────────────────────────────────────────── */}
                <div className="relative flex-1 overflow-hidden flex flex-col min-h-0 bg-linear-to-b from-muted/20 to-background">
                  {view === "calendar" ? (
                    <PreviewCalendar
                      project={activeProject}
                      onTaskClick={openTask}
                    />
                  ) : view === "gantt" ? (
                    <MockGanttView
                      key={activeProject.id}
                      project={activeProject}
                      onTaskClick={openTask}
                    />
                  ) : view === "board" ? (
                    <PreviewBoard
                      details={taskDetails}
                      project={filteredProject ?? activeProject}
                      onTaskClick={openTask}
                    />
                  ) : (
                    <PrivateListView
                      project={filteredProject ?? activeProject}
                      onTaskClick={openTask}
                    />
                  )}
                </div>
              </>
            )}
          </SidebarInset>
        </SidebarProvider>
        {selectedTask && (
          <PreviewTaskDetailsPanel
            key={selectedTask.id}
            task={selectedTask}
            projectSlug={selectedTask.projectSlug}
            statusName={selectedTask.statusName}
            details={taskDetails[selectedTask.id]}
            onChange={(details) =>
              setTaskDetails((current) => ({
                ...current,
                [selectedTask.id]: details,
              }))
            }
            onClose={closeTask}
          />
        )}
      </div>
    </div>
  );
}
