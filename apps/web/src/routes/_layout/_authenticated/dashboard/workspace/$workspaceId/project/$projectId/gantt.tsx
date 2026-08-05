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
import {
  ArrowDownUp,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
} from "lucide-react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import ProjectLayout from "@/components/common/project-layout";
import { GanttTaskBar } from "@/components/gantt/gantt-task-bar";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/cn";
import { getPriorityLabel, getStatusLabel } from "@/lib/i18n/domain";
import { useUserPreferencesStore } from "@/store/user-preferences";

type GanttSort = "start" | "end" | "priority" | "title";

const PRIORITY_ORDER: Record<string, number> = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
  none: 4,
};

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
  const [sortBy, setSortBy] = useState<GanttSort>("start");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [assigneeFilter, setAssigneeFilter] = useState<string>("all");
  const isMobile = useIsMobile();
  const [isTaskRailOpen, setIsTaskRailOpen] = useState(false);

  // Wider day columns on small screens so dragging and reading dates is easier.
  const dayColumnWidthRem = isMobile ? 3.125 : 2.75;
  const taskColumnWidthRem = isMobile ? 12 : 14;
  const showTaskRail = !isMobile || isTaskRailOpen;
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const [pixelsPerDay, setPixelsPerDay] = useState(44);

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

  const availableStatuses = useMemo(() => {
    const set = new Set<string>();
    parsedTasks.forEach((task) => {
      set.add(task.status);
    });
    return Array.from(set).sort();
  }, [parsedTasks]);

  const availablePriorities = useMemo(() => {
    const set = new Set<string>();
    parsedTasks.forEach((task) => {
      if (task.priority) set.add(task.priority);
    });
    return Array.from(set).sort();
  }, [parsedTasks]);

  const availableAssignees = useMemo(() => {
    const map = new Map<string, string>();
    parsedTasks.forEach((task) => {
      if (task.assigneeId) {
        map.set(task.assigneeId, task.assigneeName ?? task.assigneeId);
      }
    });
    return Array.from(map.entries()).sort((left, right) =>
      left[1].localeCompare(right[1], undefined, { sensitivity: "base" }),
    );
  }, [parsedTasks]);

  const scheduledTasks = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const filtered = parsedTasks.filter((task) => {
      if (statusFilter !== "all" && task.status !== statusFilter) return false;
      if (priorityFilter !== "all") {
        if (priorityFilter === "none") {
          if (task.priority) return false;
        } else if (task.priority !== priorityFilter) {
          return false;
        }
      }
      if (assigneeFilter !== "all") {
        if (assigneeFilter === "none") {
          if (task.assigneeId) return false;
        } else if (task.assigneeId !== assigneeFilter) {
          return false;
        }
      }
      if (!normalizedQuery) return true;
      return (
        task.title.toLowerCase().includes(normalizedQuery) ||
        `${project?.slug ?? ""}-${task.number ?? ""}`
          .toLowerCase()
          .includes(normalizedQuery) ||
        task.status.toLowerCase().includes(normalizedQuery)
      );
    });

    const sorted = [...filtered];
    switch (sortBy) {
      case "end":
        sorted.sort(
          (left, right) =>
            left.scheduleEnd.getTime() - right.scheduleEnd.getTime(),
        );
        break;
      case "priority":
        sorted.sort((left, right) => {
          const leftOrder =
            PRIORITY_ORDER[left.priority ?? "none"] ?? PRIORITY_ORDER.none;
          const rightOrder =
            PRIORITY_ORDER[right.priority ?? "none"] ?? PRIORITY_ORDER.none;
          if (leftOrder !== rightOrder) return leftOrder - rightOrder;
          return left.scheduleStart.getTime() - right.scheduleStart.getTime();
        });
        break;
      case "title":
        sorted.sort((left, right) =>
          left.title.localeCompare(right.title, undefined, {
            sensitivity: "base",
          }),
        );
        break;
      default:
        sorted.sort(
          (left, right) =>
            left.scheduleStart.getTime() - right.scheduleStart.getTime(),
        );
        break;
    }
    return sorted;
  }, [
    parsedTasks,
    project?.slug,
    searchQuery,
    sortBy,
    statusFilter,
    priorityFilter,
    assigneeFilter,
  ]);

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
        <div className="space-y-3 border-b border-border/80 px-3 py-3 sm:px-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="space-y-1">
              <h1 className="text-sm font-semibold text-foreground">
                {t("tasks:gantt.title")}
              </h1>
            </div>

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

          {parsedTasks.length > 0 ? (
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
              <div className="relative w-full sm:max-w-sm sm:flex-1">
                <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={t("tasks:gantt.searchPlaceholder")}
                  className="h-9 min-h-11 touch-manipulation sm:h-8 sm:min-h-0 [&_[data-slot=input]]:pl-8 [&_[data-slot=input]]:text-xs"
                />
              </div>

              <div className="grid grid-cols-1 gap-2 sm:flex sm:flex-wrap">
                <Select
                  value={sortBy}
                  onValueChange={(value) => {
                    if (
                      value === "start" ||
                      value === "end" ||
                      value === "priority" ||
                      value === "title"
                    ) {
                      setSortBy(value);
                    }
                  }}
                >
                  <SelectTrigger
                    size="sm"
                    aria-label={t("tasks:gantt.sortLabel")}
                    className="min-h-11 sm:min-h-8 sm:w-44"
                  >
                    <ArrowDownUp className="size-3.5 text-muted-foreground" />
                    <SelectValue>
                      {t(`tasks:gantt.sortOptions.${sortBy}`)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectPopup>
                    <SelectItem value="start">
                      {t("tasks:gantt.sortOptions.start")}
                    </SelectItem>
                    <SelectItem value="end">
                      {t("tasks:gantt.sortOptions.end")}
                    </SelectItem>
                    <SelectItem value="priority">
                      {t("tasks:gantt.sortOptions.priority")}
                    </SelectItem>
                    <SelectItem value="title">
                      {t("tasks:gantt.sortOptions.title")}
                    </SelectItem>
                  </SelectPopup>
                </Select>

                {availableStatuses.length > 1 ? (
                  <Select
                    value={statusFilter}
                    onValueChange={(value) => setStatusFilter(value)}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t("tasks:gantt.statusFilterLabel")}
                      className="min-h-11 sm:min-h-8 sm:w-44"
                    >
                      <Filter className="size-3.5 text-muted-foreground" />
                      <SelectValue>
                        {statusFilter === "all"
                          ? t("tasks:gantt.allStatuses")
                          : getStatusLabel(statusFilter)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="all">
                        {t("tasks:gantt.allStatuses")}
                      </SelectItem>
                      {availableStatuses.map((status) => (
                        <SelectItem key={status} value={status}>
                          {getStatusLabel(status)}
                        </SelectItem>
                      ))}
                    </SelectPopup>
                  </Select>
                ) : null}

                {availablePriorities.length > 1 ? (
                  <Select
                    value={priorityFilter}
                    onValueChange={(value) => setPriorityFilter(value)}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t("tasks:gantt.priorityFilterLabel")}
                      className="min-h-11 sm:min-h-8 sm:w-44"
                    >
                      <Filter className="size-3.5 text-muted-foreground" />
                      <SelectValue>
                        {priorityFilter === "all"
                          ? t("tasks:gantt.allPriorities")
                          : priorityFilter === "none"
                            ? t("tasks:gantt.noPriority")
                            : getPriorityLabel(priorityFilter)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="all">
                        {t("tasks:gantt.allPriorities")}
                      </SelectItem>
                      {availablePriorities.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {getPriorityLabel(priority)}
                        </SelectItem>
                      ))}
                      {!availablePriorities.includes("none") &&
                      parsedTasks.some((task) => !task.priority) ? (
                        <SelectItem value="none">
                          {t("tasks:gantt.noPriority")}
                        </SelectItem>
                      ) : null}
                    </SelectPopup>
                  </Select>
                ) : null}

                {availableAssignees.length > 0 ? (
                  <Select
                    value={assigneeFilter}
                    onValueChange={(value) => setAssigneeFilter(value)}
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label={t("tasks:gantt.assigneeFilterLabel")}
                      className="min-h-11 sm:min-h-8 sm:w-44"
                    >
                      <Filter className="size-3.5 text-muted-foreground" />
                      <SelectValue>
                        {assigneeFilter === "all"
                          ? t("tasks:gantt.allAssignees")
                          : assigneeFilter === "none"
                            ? t("tasks:gantt.unassigned")
                            : (availableAssignees.find(
                                ([id]) => id === assigneeFilter,
                              )?.[1] ?? assigneeFilter)}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectPopup>
                      <SelectItem value="all">
                        {t("tasks:gantt.allAssignees")}
                      </SelectItem>
                      {availableAssignees.map(([id, name]) => (
                        <SelectItem key={id} value={id}>
                          {name}
                        </SelectItem>
                      ))}
                      {parsedTasks.some((task) => !task.assigneeId) ? (
                        <SelectItem value="none">
                          {t("tasks:gantt.unassigned")}
                        </SelectItem>
                      ) : null}
                    </SelectPopup>
                  </Select>
                ) : null}
              </div>
            </div>
          ) : null}
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
          <div className="min-h-0 flex-1 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]">
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

                    return (
                      <div
                        key={day.toISOString()}
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
                            isToday(day) &&
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
                    const isSubtask = task.parentTaskId !== null;
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
                              style={{
                                paddingLeft: isSubtask
                                  ? isMobile
                                    ? "1.5rem"
                                    : "1.75rem"
                                  : undefined,
                              }}
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
                                {task.subtasks && task.subtasks.length > 0 ? (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                    <CornerDownRight className="size-3" />
                                    {task.subtasks.length}
                                  </span>
                                ) : null}
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
