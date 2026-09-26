import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, format, isSameMonth, isToday } from "date-fns";
import {
  Calendar,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Route as RouteIcon,
  Search,
} from "lucide-react";
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
import type {
  DependencyEdgeInput,
  TaskBarBox,
} from "@/components/gantt/dependency-lines";
import { buildDependencyEdges } from "@/components/gantt/dependency-lines";
import type { CriticalPathEdgeInput } from "@/components/gantt/gantt-critical-path";
import { computeCriticalPath } from "@/components/gantt/gantt-critical-path";
import type { CascadeEdge } from "@/components/gantt/gantt-dependency-cascade";
import { computeDependencyCascade } from "@/components/gantt/gantt-dependency-cascade";
import { GanttDependencyOverlay } from "@/components/gantt/gantt-dependency-overlay";
import type { ExternalGanttTask } from "@/components/gantt/gantt-external-task-bar";
import { GanttExternalTaskBar } from "@/components/gantt/gantt-external-task-bar";
import {
  buildTaskHierarchy,
  computeParentSummarySpans,
  flattenGanttRows,
  type ScheduleSpan,
} from "@/components/gantt/gantt-hierarchy";
import {
  findLinkDropTarget,
  type LinkDropCandidate,
  linkSourceAnchorPoint,
} from "@/components/gantt/gantt-link-drag";
import { GanttSummaryTaskBar } from "@/components/gantt/gantt-summary-task-bar";
import { GanttTaskBar, toIsoDay } from "@/components/gantt/gantt-task-bar";
import {
  buildHolidayDateKeySet,
  DEFAULT_WORKING_DAYS,
  isWorkingDay,
} from "@/components/gantt/gantt-working-calendar";
import { computePanScrollPosition } from "@/components/gantt/pan";
import {
  buildGanttGridMetrics,
  buildGanttHeaderColumns,
  buildGanttRange,
  computeInsetBarBox,
  deriveTaskSchedule,
  GANTT_UNITS,
  type GanttUnit,
  getBarEdgeInsetPx,
  getBarGridColumns,
  parseTaskDate,
} from "@/components/gantt/timeline";
import {
  isZoomWheelGesture,
  nextGanttZoom,
  normalizeWheelDeltaY,
  scrollLeftForZoom,
} from "@/components/gantt/zoom";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useBulkUpdateTaskSchedule } from "@/hooks/mutations/task/use-bulk-update-task-schedule";
import useCreateTaskRelation from "@/hooks/mutations/task-relation/use-create-task-relation";
import useGetCalendar from "@/hooks/queries/calendar/use-get-calendar";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetProjectTaskRelations from "@/hooks/queries/task-relation/use-get-project-task-relations";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/cn";
import { HttpError } from "@/lib/http-error";
import { getStatusLabel } from "@/lib/i18n/domain";
import { toast } from "@/lib/toast";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";

type GanttSearchParams = {
  taskId?: string;
};

type OwnScheduledTask = Task & {
  scheduleStart: Date;
  scheduleEnd: Date;
  isExternal: false;
  // Rollup metadata (see gantt-hierarchy.ts). A row is either a summary
  // parent (isSummary, scheduleStart/scheduleEnd already overridden to the
  // rolled-up span) or a one-level child (parentTaskId set), never both.
  isSummary: boolean;
  parentTaskId: string | null;
};

type ExternalScheduledTask = ExternalGanttTask & { isExternal: true };

// A Gantt row is either one of this project's own tasks or a related task
// pulled in from another project (see `externalRelatedTasks` below) — the
// discriminant lets the row-rendering loop pick the right bar and rail cell
// without a type assertion.
type GanttRowTask = OwnScheduledTask | ExternalScheduledTask;

// Static i18n keys (never built from `unit` at the call site) for each
// segmented-control option, per AGENTS.md's static-keys rule.
const GANTT_UNIT_LABEL_KEYS: Record<GanttUnit, string> = {
  day: "tasks:gantt.unitDay",
  week: "tasks:gantt.unitWeek",
  month: "tasks:gantt.unitMonth",
  quarter: "tasks:gantt.unitQuarter",
};

// Base (unzoomed) day-column width per unit and screen size, in rem. The
// underlying grid is always per-day (see timeline.ts), so these are chosen
// to make one grid *column group* — a day/week/month/quarter — land at a
// sensible on-screen width once the header groups days under it: roughly
// 44px/2.75rem for a day, ~64px for a week, ~90px for an average month,
// ~110px for a quarter (desktop; mobile is a little wider throughout for
// touch dragging). Wheel-zoom (see `zoom` below) then scales this further
// within the chosen unit.
const UNIT_BASE_DAY_COLUMN_WIDTH_REM: Record<
  GanttUnit,
  { desktop: number; mobile: number }
> = {
  day: { desktop: 2.75, mobile: 3.125 },
  week: { desktop: 0.82, mobile: 0.92 },
  month: { desktop: 0.185, mobile: 0.22 },
  quarter: { desktop: 0.076, mobile: 0.09 },
};

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/gantt",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): GanttSearchParams => ({
    taskId: typeof search.taskId === "string" ? search.taskId : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId, workspaceId } = Route.useParams();
  const { taskId } = Route.useSearch();
  const navigate = useNavigate();
  const { data: project } = useGetTasks(projectId);
  // Workspace working calendar (weekends + holidays): shades non-working day
  // columns below and, via `workingDayPredicate`, keeps the auto-reschedule
  // cascade from landing a pushed task's start on one. Defaults to the
  // standard Mon-Fri bitmask with no holidays while the query is still
  // loading, rather than shading nothing.
  const { data: calendar } = useGetCalendar(workspaceId);
  const workingDays = calendar?.workingDays ?? DEFAULT_WORKING_DAYS;
  const holidayDateSet = useMemo(
    () => buildHolidayDateKeySet(calendar?.holidays ?? []),
    [calendar?.holidays],
  );
  const workingDayPredicate = useCallback(
    (date: Date) => isWorkingDay(date, workingDays, holidayDateSet),
    [workingDays, holidayDateSet],
  );
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
  // Persisted (localStorage, via the same zustand store as weekStartsOn/
  // viewMode) so the chosen granularity survives a reload — a per-viewer
  // preference, not per-project state, matching how the rest of this store's
  // display preferences behave.
  const ganttUnit = useUserPreferencesStore((state) => state.ganttTimelineUnit);
  const setGanttUnit = useUserPreferencesStore(
    (state) => state.setGanttTimelineUnit,
  );
  // Persisted the same way as ganttTimelineUnit above (localStorage, via this
  // same store) — a per-viewer display preference, not per-project state.
  const showCriticalPath = useUserPreferencesStore(
    (state) => state.ganttShowCriticalPath,
  );
  const setShowCriticalPath = useUserPreferencesStore(
    (state) => state.setGanttShowCriticalPath,
  );
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

  // Wider day columns on small screens so dragging and reading dates is easier.
  const baseDayColumnWidthRem = isMobile
    ? UNIT_BASE_DAY_COLUMN_WIDTH_REM[ganttUnit].mobile
    : UNIT_BASE_DAY_COLUMN_WIDTH_REM[ganttUnit].desktop;
  // Mouse-wheel zoom scales the base width by this factor (see the wheel
  // listener below); 1 is the default, unzoomed scale. Zoom stays a *within*
  // -unit fine adjustment — switching units (the segmented control below) is
  // the coarse control, and resets zoom back to 1 so the new unit's base
  // width is what you see first.
  const [zoom, setZoom] = useState(1);
  const dayColumnWidthRem = baseDayColumnWidthRem * zoom;
  const handleUnitChange = useCallback(
    (unit: GanttUnit) => {
      if (unit === ganttUnit) return;
      setGanttUnit(unit);
      setZoom(1);
    },
    [ganttUnit, setGanttUnit],
  );
  const taskColumnWidthRem = isMobile ? 12 : 14;
  const showTaskRail = !isMobile || isTaskRailOpen;
  const timelineTrackRef = useRef<HTMLDivElement>(null);
  const [pixelsPerDay, setPixelsPerDay] = useState(44);
  // Pixels from the rows container's left edge to where the day columns
  // start — i.e. the task rail's rendered width, measured rather than
  // recomputed from its rem value so it always matches the actual layout
  // (rail hidden, mobile width, etc).
  const [barsLeftPx, setBarsLeftPx] = useState(0);
  // Mirrors `barsLeftPx` for the wheel-zoom handler below: that handler is a
  // native (non-passive) listener living outside React's render cycle, so it
  // reads this ref rather than closing over possibly-stale state.
  const barsLeftPxRef = useRef(0);
  // The scrollable viewport (drag-to-pan reads/writes its scrollLeft and
  // scrollTop directly) and the chart's own root (drag-to-pan and wheel-zoom
  // are both scoped to pointer/wheel events inside it, not the toolbar above).
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const chartRootRef = useRef<HTMLDivElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStateRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  // Set by the wheel handler when a zoom step changes the day-column width;
  // applied by a layout effect once the grid has actually re-rendered at the
  // new width, since the target scrollLeft has to be computed (and clamped
  // by the browser) against the NEW scrollWidth, not the one at wheel time.
  const pendingScrollLeftRef = useRef<number | null>(null);
  const todayCellRef = useRef<HTMLDivElement>(null);
  const rowsContainerRef = useRef<HTMLDivElement>(null);
  const rowElementsRef = useRef(new Map<string, HTMLDivElement>());
  // Each row's rendered top offset and height, relative to `rowsContainerRef`
  // — measured rather than assumed, because a row's height depends on its
  // task-rail content (title wrapping, the "show task dates" link for
  // out-of-window tasks), which isn't uniform across rows.
  const [rowLayout, setRowLayout] = useState<
    Map<string, { top: number; height: number }>
  >(new Map());
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);
  // The in-progress "drag to create a dependency" gesture (see
  // handleLinkDragStart below): which task the drag started from, the
  // preview line's fixed source point (the bar's finish edge at drag-start —
  // it doesn't track that bar afterward, since neither move/resize can run
  // at the same time as this gesture), and the live pointer position. Null
  // whenever no such gesture is in progress.
  const [linkDrag, setLinkDrag] = useState<{
    sourceTaskId: string;
    sourcePoint: { x: number; y: number };
    pointerPoint: { x: number; y: number };
  } | null>(null);
  const createTaskRelation = useCreateTaskRelation();
  // Measured once at mount rather than kept live: the root font size a
  // dependency line's edge inset is derived from (see getBarEdgeInsetPx)
  // only changes with a browser/OS zoom or text-size setting, which is
  // effectively always in place before the chart is opened, not something
  // that changes while looking at it.
  const [barEdgeInsetPx] = useState(getBarEdgeInsetPx);
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
  // Which summary-parent rows (see gantt-hierarchy.ts) are collapsed, hiding
  // their children. Not persisted: it's a per-visit display toggle, default
  // expanded, the same way task-subtasks.tsx's own subtasks panel defaults
  // open. Ids are task ids, so stale entries from a previously viewed
  // project are simply inert rather than actively wrong, but they're cleared
  // below anyway to keep a freshly opened project's rows expanded.
  const [collapsedParentIds, setCollapsedParentIds] = useState<Set<string>>(
    new Set(),
  );
  if (previousProjectIdRef.current !== projectId) {
    previousProjectIdRef.current = projectId;
    hasCenteredOnTodayRef.current = false;
    setCollapsedParentIds(new Set());
  }
  const toggleParentCollapsed = useCallback((parentId: string) => {
    setCollapsedParentIds((current) => {
      const next = new Set(current);
      if (next.has(parentId)) {
        next.delete(parentId);
      } else {
        next.add(parentId);
      }
      return next;
    });
  }, []);

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

  // Declared here (rather than down with the other relation-derived values
  // below) because the hierarchy/rollup step just below needs it to build
  // `parsedTasks` — a "subtask" relation is hierarchy, not a dependency line
  // (see the dependencyEdges comment further down), but it still comes from
  // this same per-project relations fetch.
  const { data: taskRelations } = useGetProjectTaskRelations(projectId);

  // Parent -> children (and back) from this project's own "subtask"
  // relations. Built from every own task id (not just ones with a schedule
  // of their own) since a parent with no dates of its own can still gain one
  // via rollup below. See gantt-hierarchy.ts for the one-level-of-nesting
  // limit.
  const taskHierarchy = useMemo(() => {
    const subtaskRelations = (taskRelations ?? []).flatMap((relation) =>
      relation.relationType === "subtask"
        ? [
            {
              sourceTaskId: relation.sourceTaskId,
              targetTaskId: relation.targetTaskId,
            },
          ]
        : [],
    );
    return buildTaskHierarchy(
      allTasks.map((task) => task.id),
      subtaskRelations,
    );
  }, [allTasks, taskRelations]);

  // Every own task's OWN derived schedule (its own startDate/dueDate only —
  // never a rolled-up span). This is what summary rollup reads a parent's
  // children from, and what a plain/child row uses directly.
  const ownScheduleByTaskId = useMemo(() => {
    const map = new Map<string, ScheduleSpan>();
    for (const task of allTasks) {
      const schedule = deriveTaskSchedule(task.startDate, task.dueDate);
      if (schedule) map.set(task.id, schedule);
    }
    return map;
  }, [allTasks]);

  const summarySpanByParentId = useMemo(
    () => computeParentSummarySpans(taskHierarchy, ownScheduleByTaskId),
    [taskHierarchy, ownScheduleByTaskId],
  );

  const parsedTasks = useMemo<OwnScheduledTask[]>(() => {
    return allTasks
      .map((task) => {
        const parentTaskId =
          taskHierarchy.parentIdByChildId.get(task.id) ?? null;
        const summarySpan = summarySpanByParentId.get(task.id);
        // A summary parent's span always comes from its children (see
        // computeParentSummarySpans) — its own startDate/dueDate, if any,
        // are ignored once it has at least one spanned child, so the bar
        // always reads as "the span of the children", never a mix of the
        // two.
        const isSummary = summarySpan !== undefined;
        const schedule = isSummary
          ? summarySpan
          : (ownScheduleByTaskId.get(task.id) ?? null);
        if (!schedule) return null;

        return {
          ...task,
          scheduleStart: schedule.start,
          scheduleEnd: schedule.end,
          isExternal: false as const,
          isSummary,
          parentTaskId,
        };
      })
      .filter((task): task is NonNullable<typeof task> => task !== null)
      .sort(
        (left, right) =>
          left.scheduleStart.getTime() - right.scheduleStart.getTime(),
      );
  }, [allTasks, taskHierarchy, summarySpanByParentId, ownScheduleByTaskId]);

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

  // Every scheduled own task id currently passing the search filter — used
  // just below to tell a genuinely nested child from one whose parent the
  // search filtered out.
  const scheduledTaskIds = useMemo(
    () => new Set(scheduledTasks.map((task) => task.id)),
    [scheduledTasks],
  );

  // A child renders nested under its parent only while that parent is ALSO
  // still showing. A search that matches a child but not its parent — e.g.
  // searching a subtask's own title — would otherwise make that child
  // vanish entirely (flattenGanttRows only visits a parent's children when
  // the parent itself is in the top-level list): treating it as an ordinary
  // top-level row instead keeps every search match visible, the same as
  // before this feature existed.
  const isNestedChild = useCallback(
    (task: OwnScheduledTask) =>
      task.parentTaskId !== null && scheduledTaskIds.has(task.parentTaskId),
    [scheduledTaskIds],
  );

  // Top-level own rows (not a one-level, still-visible child of another row)
  // versus each visible parent's own (search-filtered) children — split out
  // of `scheduledTasks` so the render below can place children directly
  // under their parent (via flattenGanttRows) instead of interleaving them
  // into the flat chronological sort every other row uses.
  const topLevelOwnTasks = useMemo(
    () => scheduledTasks.filter((task) => !isNestedChild(task)),
    [scheduledTasks, isNestedChild],
  );

  const childOwnTasksByParentId = useMemo(() => {
    const map = new Map<string, OwnScheduledTask[]>();
    for (const task of scheduledTasks) {
      if (!isNestedChild(task) || !task.parentTaskId) continue;
      const siblings = map.get(task.parentTaskId);
      if (siblings) siblings.push(task);
      else map.set(task.parentTaskId, [task]);
    }
    return map;
  }, [scheduledTasks, isNestedChild]);

  // "subtask" relations describe hierarchy (built into summary rows above),
  // not scheduling dependency, and the task rail already communicates
  // hierarchy via indentation/collapse; drawing dependency lines for them
  // here would only clutter the chart, so only "blocks" and "related" become
  // dependency edges. (`taskRelations` itself is fetched further up, where
  // the hierarchy is built from it.)
  const dependencyEdges = useMemo<DependencyEdgeInput[]>(() => {
    return (taskRelations ?? []).flatMap((relation) => {
      if (
        relation.relationType !== "blocks" &&
        relation.relationType !== "related"
      ) {
        return [];
      }
      return [
        {
          id: relation.id,
          sourceTaskId: relation.sourceTaskId,
          targetTaskId: relation.targetTaskId,
          relationType: relation.relationType,
          dependencyType: relation.dependencyType as "fs" | "ss" | "ff" | "sf",
          lagDays: relation.lagDays,
        },
      ];
    });
  }, [taskRelations]);

  // Only "blocks" edges are scheduling constraints (see
  // gantt-dependency-cascade.ts) — a "related" edge is purely informational
  // and never pushes a dependent's dates. Kept separate from
  // `dependencyEdges` above, which also draws "related" lines.
  const blocksEdges = useMemo<CascadeEdge[]>(() => {
    return (taskRelations ?? []).flatMap((relation) =>
      relation.relationType === "blocks"
        ? [
            {
              sourceTaskId: relation.sourceTaskId,
              targetTaskId: relation.targetTaskId,
              dependencyType: relation.dependencyType as
                | "fs"
                | "ss"
                | "ff"
                | "sf",
              lagDays: relation.lagDays,
            },
          ]
        : [],
    );
  }, [taskRelations]);

  // Same "blocks" edges as blocksEdges above, but keeping each relation's own
  // id (computeCriticalPath needs one to identify which edges came out
  // critical) — kept as a separate memo rather than folding the id into
  // blocksEdges itself, since CascadeEdge's shape is also handed to
  // computeDependencyCascade below and widening it isn't otherwise needed.
  const criticalPathEdges = useMemo<CriticalPathEdgeInput[]>(() => {
    return (taskRelations ?? []).flatMap((relation) =>
      relation.relationType === "blocks"
        ? [
            {
              id: relation.id,
              sourceTaskId: relation.sourceTaskId,
              targetTaskId: relation.targetTaskId,
              dependencyType: relation.dependencyType as
                | "fs"
                | "ss"
                | "ff"
                | "sf",
              lagDays: relation.lagDays,
            },
          ]
        : [],
    );
  }, [taskRelations]);

  // Only computed while the toggle is on — this project can have a lot of
  // "blocks" edges, and there's no reason to run the CPM passes on every
  // relations refetch when nobody's looking at the result. Depends only on
  // each own task's OWN schedule (ownScheduleByTaskId, same scope the
  // dependency cascade above uses — cross-project and dateless tasks never
  // participate) and the edges themselves, never on zoom/pan/unit state, so
  // toggling zoom doesn't recompute it.
  const criticalPath = useMemo(() => {
    if (!showCriticalPath) return null;
    const tasksInput = [...ownScheduleByTaskId].map(([id, schedule]) => ({
      id,
      scheduleStart: schedule.start,
      scheduleEnd: schedule.end,
    }));
    return computeCriticalPath(tasksInput, criticalPathEdges);
  }, [showCriticalPath, ownScheduleByTaskId, criticalPathEdges]);

  const bulkUpdateSchedule = useBulkUpdateTaskSchedule();

  // Runs once a drag-move or resize has already persisted the DRAGGED task's
  // own new dates (see onDatesCommitted on GanttTaskBar) — this only ever
  // pushes its "blocks" DEPENDENTS later to keep the constraint satisfied,
  // never touches the dragged task again, and never moves anything earlier
  // (see gantt-dependency-cascade.ts for the full forward-only model).
  //
  // `ownScheduleByTaskId` is this project's own tasks with known dates —
  // exactly the scope the cascade is allowed to shift (a cross-project
  // dependent, or a same-project task with no dates, simply has no entry
  // and is left alone). It can still be one render behind the task's actual
  // new dates (the mutation that just resolved hasn't finished
  // invalidating/refetching yet), so the moved task's own entry is
  // overridden here with the dates it was just dragged/resized to, rather
  // than trusting the stale cached copy.
  const handleTaskDatesCommitted = useCallback(
    (movedTaskId: string, start: Date, end: Date) => {
      const tasksById = new Map(ownScheduleByTaskId);
      tasksById.set(movedTaskId, { start, end });

      const shifts = computeDependencyCascade({
        movedTaskId,
        edges: blocksEdges,
        tasksById,
        isWorkingDay: workingDayPredicate,
      });
      if (shifts.size === 0) return;

      const scheduleUpdates = [...shifts.entries()].map(
        ([taskId, schedule]) => ({
          taskId,
          startDate: toIsoDay(schedule.start),
          dueDate: toIsoDay(schedule.end),
        }),
      );

      bulkUpdateSchedule
        .mutateAsync({ projectId, scheduleUpdates })
        .then(() => {
          toast.success(
            t("tasks:gantt.dependentsRescheduled", {
              count: scheduleUpdates.length,
            }),
          );
        })
        .catch(() => {
          toast.error(t("tasks:gantt.dependentsRescheduleError"));
        });
    },
    [
      ownScheduleByTaskId,
      blocksEdges,
      bulkUpdateSchedule,
      projectId,
      t,
      workingDayPredicate,
    ],
  );

  // A related/blocking task from another project has no row of its own on
  // this board, so a cross-project edge would otherwise always be dropped
  // for lack of a box. Pull in the far end of every such relation as an
  // extra, read-only Gantt row instead — as long as it actually has a date
  // to place it by; one with neither startDate nor dueDate still can't be
  // positioned here and is left out, same as any own task with no dates.
  const externalRelatedTasks = useMemo<ExternalScheduledTask[]>(() => {
    const external = new Map<string, ExternalScheduledTask>();
    for (const relation of taskRelations ?? []) {
      if (relation.relationType === "subtask") continue;
      for (const candidate of [relation.sourceTask, relation.targetTask]) {
        if (!candidate || candidate.projectId === projectId) continue;
        if (external.has(candidate.id)) continue;
        const schedule = deriveTaskSchedule(
          candidate.startDate,
          candidate.dueDate,
        );
        if (!schedule) continue;
        external.set(candidate.id, {
          id: candidate.id,
          title: candidate.title,
          number: candidate.number,
          projectName: candidate.projectName,
          projectSlug: candidate.projectSlug,
          scheduleStart: schedule.start,
          scheduleEnd: schedule.end,
          isMilestone: candidate.isMilestone,
          isExternal: true as const,
        });
      }
    }
    return [...external.values()];
  }, [taskRelations, projectId]);

  // The date window (which 91 days are in view, and the paging bounds
  // around them) depends only on the task list, the week-start preference,
  // and which page is requested — never on the zoomed day-column width.
  // Keeping it in its own memo means `range.days` (and its 91 Date objects)
  // stays referentially stable across zoom changes, so wheel-zooming
  // doesn't rebuild the whole date range on every notch; only the grid
  // metrics below (a string template and a multiplication) actually need to
  // recompute with the zoomed width. `externalRelatedTasks` only widens the
  // reachable paging bounds (see buildGanttRange) so an external row dated
  // outside this project's own tasks can still be paged/jumped to — it never
  // moves the default page own tasks alone would open to.
  const range = useMemo(
    () =>
      buildGanttRange(
        parsedTasks,
        weekStartsOn,
        requestedStart,
        undefined,
        ganttUnit,
        externalRelatedTasks,
      ),
    [
      parsedTasks,
      weekStartsOn,
      requestedStart,
      ganttUnit,
      externalRelatedTasks,
    ],
  );

  const gridMetrics = useMemo(
    () =>
      range
        ? buildGanttGridMetrics(range.days.length, dayColumnWidthRem)
        : null,
    [range, dayColumnWidthRem],
  );

  const timeline = useMemo(
    () => (range && gridMetrics ? { ...range, ...gridMetrics } : null),
    [range, gridMetrics],
  );

  // The header's own grouping (a week/month/quarter under one label) — kept
  // separate from `range`/`timeline` above so it only recomputes when the
  // visible days or the unit/week-start actually change, not on every zoom
  // step. See buildGanttHeaderColumns for why the underlying per-day grid
  // doesn't need to know about this at all.
  const headerColumns = useMemo(
    () =>
      range ? buildGanttHeaderColumns(range.days, ganttUnit, weekStartsOn) : [],
    [range, ganttUnit, weekStartsOn],
  );

  // Which day indices sit at the END of a header column (always every index
  // for Day, since each day is its own column) — the background day-track at
  // that index gets a divider border, so Week/Month/Quarter draw a line
  // between groups instead of between every single day.
  const headerColumnEndIndices = useMemo(
    () => new Set(headerColumns.map((column) => column.endIndex)),
    [headerColumns],
  );

  // Whether "today" actually falls inside the computed date range. A project
  // made up entirely of past or far-future tasks has no "today" column to
  // jump to, so the button below is disabled in that case instead of doing
  // nothing silently.
  const todayInRange = useMemo(
    () => range?.days.some((day) => isToday(day)) ?? false,
    [range],
  );

  const isSearchActive = searchQuery.trim().length > 0;

  // An external row exists only to give a cross-project dependency line
  // somewhere to land, so once a search is active it's only kept when it's
  // still connected (by a "blocks"/"related" edge — see dependencyEdges
  // below) to one of THIS project's own tasks that the search actually
  // matched; an external row whose only connected own task got filtered out
  // is an orphan with no line to attach to and would otherwise show up
  // unfiltered regardless of the query. With no search active, every
  // related external task shows as before.
  const visibleExternalRelatedTasks = useMemo(() => {
    if (!isSearchActive) return externalRelatedTasks;
    const visibleOwnTaskIds = new Set(scheduledTasks.map((task) => task.id));
    const connectedExternalIds = new Set<string>();
    for (const edge of dependencyEdges) {
      if (visibleOwnTaskIds.has(edge.sourceTaskId)) {
        connectedExternalIds.add(edge.targetTaskId);
      }
      if (visibleOwnTaskIds.has(edge.targetTaskId)) {
        connectedExternalIds.add(edge.sourceTaskId);
      }
    }
    return externalRelatedTasks.filter((task) =>
      connectedExternalIds.has(task.id),
    );
  }, [isSearchActive, externalRelatedTasks, scheduledTasks, dependencyEdges]);

  // Every row the grid actually draws: this project's own top-level
  // (search-filtered) tasks plus the (also search-aware, see above) external
  // related tasks, chronologically interleaved so the two kinds of rows sort
  // by date rather than externals always trailing at the bottom — then each
  // expanded parent's own children spliced in directly after it (see
  // flattenGanttRows) so a child always sits under its parent regardless of
  // how its date compares to whatever unrelated row would otherwise land
  // between them. A collapsed parent's children are left out of this list
  // entirely: they never get a row, a measured box, or therefore a
  // dependency line (buildDependencyEdges above already skips any edge
  // missing either endpoint's box), rather than rendering hidden or
  // rerouting their lines to the summary bar — the same "no box, no line"
  // rule every other hidden-row case (out of window, search-filtered) here
  // already relies on. When the search matches zero own tasks, this is empty
  // too (no own task is "visible" to connect an external row to), so the "no
  // tasks found" state below and the chart's row list agree on when there's
  // nothing to show.
  const renderedTasks = useMemo<GanttRowTask[]>(() => {
    const topLevelChronological = [
      ...topLevelOwnTasks,
      ...visibleExternalRelatedTasks,
    ].sort(
      (left, right) =>
        left.scheduleStart.getTime() - right.scheduleStart.getTime(),
    );
    return flattenGanttRows(
      topLevelChronological,
      childOwnTasksByParentId,
      collapsedParentIds,
    );
  }, [
    topLevelOwnTasks,
    visibleExternalRelatedTasks,
    childOwnTasksByParentId,
    collapsedParentIds,
  ]);

  // A hovered bar can unmount without ever firing its own onMouseLeave/onBlur
  // — most commonly a search change filtering its task out of
  // `renderedTasks` — which would otherwise leave `hoveredTaskId` (and every
  // non-incident dependency line's dimmed state) stuck forever. Clear it as
  // soon as the hovered task is no longer one of the rendered rows.
  useEffect(() => {
    if (!hoveredTaskId) return;
    if (renderedTasks.some((task) => task.id === hoveredTaskId)) return;
    setHoveredTaskId(null);
  }, [hoveredTaskId, renderedTasks]);

  // A dependency line can only be drawn between two bars that are both
  // actually on screen: in the current timeline window, passing the search
  // filter, and wide enough to render (mirrors GanttTaskBar's own barInView
  // guard — lineEnd > lineStart always holds once barInView is true, so
  // there is nothing further to guard there). Anything else — an external
  // task with no box yet, a task scrolled out of the date window, a search
  // miss — simply has no box here, and buildDependencyEdges skips edges
  // missing either end.
  const taskBoxes = useMemo(() => {
    const boxes = new Map<string, TaskBarBox>();
    if (!timeline) return boxes;
    const trackCount = timeline.days.length;

    for (const task of renderedTasks) {
      const row = rowLayout.get(task.id);
      if (!row) continue;
      // A milestone renders as a single diamond AT scheduleStart, never a
      // span (see GanttTaskBar/GanttExternalTaskBar) — including one that
      // still carries both startDate/dueDate from before it was marked a
      // milestone. Measuring its box from the full scheduleStart..scheduleEnd
      // span here (rather than the same start..start point the diamond
      // itself uses) would anchor its dependency line at the wrong end of
      // that span, and could even draw a line into the window from a
      // diamond that's actually out of view.
      const { barInView, lineStart, lineEnd } = task.isMilestone
        ? getBarGridColumns(
            task.scheduleStart,
            task.scheduleStart,
            timeline.rangeStart,
            trackCount,
          )
        : getBarGridColumns(
            task.scheduleStart,
            task.scheduleEnd,
            timeline.rangeStart,
            trackCount,
          );
      if (!barInView) continue;
      const box = computeInsetBarBox(
        barsLeftPx + (lineStart - 1) * pixelsPerDay,
        barsLeftPx + (lineEnd - 1) * pixelsPerDay,
        barEdgeInsetPx,
      );
      boxes.set(task.id, {
        left: box.left,
        right: box.right,
        top: row.top,
        height: row.height,
      });
    }
    return boxes;
  }, [
    renderedTasks,
    rowLayout,
    timeline,
    barsLeftPx,
    pixelsPerDay,
    barEdgeInsetPx,
  ]);

  const dependencyEdgeGeometry = useMemo(
    () => buildDependencyEdges(dependencyEdges, taskBoxes),
    [dependencyEdges, taskBoxes],
  );

  // The task ids that should read as "connected" to the hovered bar: itself,
  // plus every task at the other end of one of its edges — regardless of
  // whether that other task's bar is currently visible/drawable.
  const highlightedTaskIds = useMemo(() => {
    if (!hoveredTaskId) return null;
    const ids = new Set<string>([hoveredTaskId]);
    for (const edge of dependencyEdges) {
      if (edge.sourceTaskId === hoveredTaskId) ids.add(edge.targetTaskId);
      if (edge.targetTaskId === hoveredTaskId) ids.add(edge.sourceTaskId);
    }
    return ids;
  }, [hoveredTaskId, dependencyEdges]);

  const emphasisFor = useCallback(
    (taskId: string): "normal" | "highlighted" | "dimmed" => {
      if (!highlightedTaskIds) return "normal";
      return highlightedTaskIds.has(taskId) ? "highlighted" : "dimmed";
    },
    [highlightedTaskIds],
  );

  const isCriticalFor = useCallback(
    (taskId: string) => criticalPath?.criticalTaskIds.has(taskId) ?? false,
    [criticalPath],
  );

  const handleBarHoverChange = useCallback(
    (taskId: string, hovering: boolean) => {
      setHoveredTaskId((current) => {
        if (hovering) return taskId;
        // A stale leave from a bar the pointer already moved away from
        // must not clobber whichever bar is hovered now.
        return current === taskId ? null : current;
      });
    },
    [],
  );

  // Valid drop targets for a link-drag: this project's own, currently
  // visible bars — never an external (cross-project) row, which is
  // read-only here (see the AGENTS.md-driven decision recorded on
  // handleLinkDragStart below), and never a bar with no box at all (out of
  // window, search-filtered, or a search that filtered out an external row's
  // only connecting own task — the same "no box, no line" rule taskBoxes
  // itself already applies).
  const linkDropCandidates = useMemo<LinkDropCandidate[]>(() => {
    const ownTaskIds = new Set(
      renderedTasks.filter((task) => !task.isExternal).map((task) => task.id),
    );
    const candidates: LinkDropCandidate[] = [];
    for (const [taskId, box] of taskBoxes) {
      if (ownTaskIds.has(taskId)) candidates.push({ taskId, box });
    }
    return candidates;
  }, [renderedTasks, taskBoxes]);
  // Read from inside the window-level pointermove/pointerup listeners a
  // link-drag installs (see handleLinkDragStart) — those listeners live for
  // the gesture's whole duration, so they'd otherwise close over whichever
  // `linkDropCandidates` existed at drag-start and miss a box that only
  // becomes measured (or moves) while the drag is in progress.
  const linkDropCandidatesRef = useRef<LinkDropCandidate[]>(linkDropCandidates);
  useEffect(() => {
    linkDropCandidatesRef.current = linkDropCandidates;
  }, [linkDropCandidates]);

  // Starts the "drag to create a dependency" gesture from a task bar's link
  // handle (see onLinkDragStart on GanttTaskBar). Mirrors the window-listener
  // pattern GanttTaskBar's own move/resize handlers use, rather than relying
  // on pointer capture + bubbling, since this gesture's state (the preview
  // line, the drop hit-test) lives up here where every other bar's box is
  // known, not inside the bar the drag started from.
  //
  // Cross-project scope: only this project's own bars are ever valid drop
  // targets (linkDropCandidates above already excludes external rows), so
  // dropping a link-drag on a cross-project related row silently cancels —
  // keeping this first version scoped to same-project linking rather than
  // teaching it to resolve a relation against another project's board.
  const handleLinkDragStart = useCallback(
    (event: React.PointerEvent, sourceTaskId: string) => {
      const container = rowsContainerRef.current;
      const sourceBox = taskBoxes.get(sourceTaskId);
      if (!container || !sourceBox) return;

      const toLocalPoint = (clientX: number, clientY: number) => {
        const rect = container.getBoundingClientRect();
        return { x: clientX - rect.left, y: clientY - rect.top };
      };

      const sourcePoint = linkSourceAnchorPoint(sourceBox);
      setLinkDrag({
        sourceTaskId,
        sourcePoint,
        pointerPoint: toLocalPoint(event.clientX, event.clientY),
      });

      const onMove = (moveEvent: PointerEvent) => {
        setLinkDrag((current) =>
          current && current.sourceTaskId === sourceTaskId
            ? {
                ...current,
                pointerPoint: toLocalPoint(
                  moveEvent.clientX,
                  moveEvent.clientY,
                ),
              }
            : current,
        );
      };

      const finish = (endEvent: PointerEvent, shouldLink: boolean) => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        window.removeEventListener("pointercancel", onCancel);
        setLinkDrag(null);
        if (!shouldLink) return;

        const dropPoint = toLocalPoint(endEvent.clientX, endEvent.clientY);
        const targetTaskId = findLinkDropTarget(
          dropPoint,
          linkDropCandidatesRef.current,
          sourceTaskId,
        );
        // Dropped on empty space or back on the source bar itself: a no-op,
        // per spec — nothing to link, and no error to report.
        if (!targetTaskId) return;

        createTaskRelation
          .mutateAsync({
            sourceTaskId,
            targetTaskId,
            relationType: "blocks",
            dependencyType: "fs",
            lagDays: 0,
          })
          .catch((error) => {
            // Same distinction task-relations.tsx's own link flow makes: the
            // API returns a 409 both for an exact duplicate and for an edge
            // that would close a cycle, and only the latter's message
            // mentions "circular".
            const isCircularDependency =
              error instanceof HttpError &&
              error.status === 409 &&
              error.message.toLowerCase().includes("circular");
            toast.error(
              t(
                isCircularDependency
                  ? "tasks:relations.circularDependencyError"
                  : "tasks:relations.linkError",
              ),
            );
          });
      };

      const onUp = (endEvent: PointerEvent) => finish(endEvent, true);
      const onCancel = (endEvent: PointerEvent) => finish(endEvent, false);

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      window.addEventListener("pointercancel", onCancel);
    },
    [taskBoxes, createTaskRelation, t],
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

  // Whether the chart itself (as opposed to a "no tasks"/"no matches" empty
  // state) is actually mounted — used to (re)attach the wheel-zoom listener
  // once it appears, e.g. after tasks finish loading. Mirrors the same
  // "anything to render" condition the empty-state branches below use: a
  // project with no own scheduled tasks but at least one cross-project
  // related row still mounts the real chart, not the empty state.
  const chartIsMounted =
    Boolean(timeline) &&
    (scheduledTasks.length > 0 || visibleExternalRelatedTasks.length > 0);

  // A pointerdown here should start a drag-to-pan only when it lands on
  // genuinely empty timeline background or the day-header — not on a task
  // bar (which has its own drag-to-move/resize), the sticky task rail, or
  // any other interactive control. Task-bar handles are `<button>`s, so
  // matching `button`/`input`/`a`/`[role="button"]` already excludes them
  // without needing to know anything about the bar itself. An external
  // (cross-project) bar has no such button — it's read-only, so it isn't
  // draggable/resizable — but a pointerdown on it must still be excluded
  // from pan-start, or dragging it just pans the whole chart instead of
  // doing nothing; `[data-gantt-external-bar]` marks it for that.
  const isPannableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return true;
    return !target.closest(
      'button, input, a, [role="button"], [data-gantt-rail], [data-gantt-external-bar]',
    );
  }, []);

  // Drag-to-pan on empty timeline background or the day-header row. Scoped
  // to mouse input (`pointerType === "mouse"`) so it never competes with the
  // existing native touch scrolling (`touch-pan-x`/`touch-pan-y` below) that
  // mobile relies on.
  const handleChartPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0 || event.pointerType !== "mouse") return;
      if (!isPannableTarget(event.target)) return;
      const scrollEl = scrollContainerRef.current;
      if (!scrollEl) return;
      panStateRef.current = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startScrollLeft: scrollEl.scrollLeft,
        startScrollTop: scrollEl.scrollTop,
      };
      event.currentTarget.setPointerCapture?.(event.pointerId);
      setIsPanning(true);
    },
    [isPannableTarget],
  );

  const handleChartPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const state = panStateRef.current;
      const scrollEl = scrollContainerRef.current;
      if (!state || state.pointerId !== event.pointerId || !scrollEl) return;
      const next = computePanScrollPosition({
        startScrollLeft: state.startScrollLeft,
        startScrollTop: state.startScrollTop,
        deltaX: event.clientX - state.startX,
        deltaY: event.clientY - state.startY,
      });
      scrollEl.scrollLeft = next.scrollLeft;
      scrollEl.scrollTop = next.scrollTop;
    },
    [],
  );

  const endChartPan = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const state = panStateRef.current;
      if (!state || state.pointerId !== event.pointerId) return;
      panStateRef.current = null;
      setIsPanning(false);
      event.currentTarget.releasePointerCapture?.(event.pointerId);
    },
    [],
  );

  // Mouse-wheel zoom over the chart. Attached as a plain (non-passive) DOM
  // listener rather than React's onWheel: React marks wheel listeners
  // passive by default, which silently ignores preventDefault() and would
  // leave the page scrolling underneath the zoom.
  //
  // Wheeling over the sticky task rail is left alone (native vertical
  // scroll of the row list) since that's the one part of the chart that
  // isn't "the timeline" being zoomed; shift+wheel is also left alone so it
  // still works as the browser's own horizontal-scroll gesture, alongside
  // drag-to-pan. A horizontal (trackpad two-finger) swipe over the timeline
  // itself is a scroll gesture too, not a zoom one (see isZoomWheelGesture)
  // — preventDefault-ing it here would otherwise block native horizontal
  // scrolling even though no zoom happens.
  // biome-ignore lint/correctness/useExhaustiveDependencies: chartIsMounted forces the listener to (re)attach once the chart mounts; the closure itself only reads refs, not this value.
  useEffect(() => {
    const root = chartRootRef.current;
    const scrollEl = scrollContainerRef.current;
    if (!root || !scrollEl) return;

    const handleWheel = (event: WheelEvent) => {
      if (event.shiftKey) return;
      if (
        event.target instanceof Element &&
        event.target.closest("[data-gantt-rail]")
      ) {
        return;
      }
      if (!isZoomWheelGesture(event.deltaX, event.deltaY, event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      // deltaY is only pixels under the default DOM_DELTA_PIXEL mode.
      // Firefox reports a physical mouse wheel as DOM_DELTA_LINE (deltaY of
      // roughly ±3), and some trackpad/OS gestures report DOM_DELTA_PAGE
      // (deltaY of roughly ±1) — feeding either straight into a
      // pixel-tuned zoom curve barely moves it (line mode) or slams it
      // straight to the clamp (page mode).
      const normalizedDeltaY = normalizeWheelDeltaY(
        event.deltaY,
        event.deltaMode,
        window.innerHeight,
      );
      setZoom((currentZoom) => {
        const next = nextGanttZoom(currentZoom, normalizedDeltaY);
        if (next === currentZoom) return currentZoom;
        const rect = scrollEl.getBoundingClientRect();
        pendingScrollLeftRef.current = scrollLeftForZoom({
          scrollLeft: scrollEl.scrollLeft,
          pointerX: event.clientX - rect.left,
          railWidthPx: barsLeftPxRef.current,
          oldZoom: currentZoom,
          newZoom: next,
        });
        return next;
      });
    };

    root.addEventListener("wheel", handleWheel, { passive: false });
    return () => root.removeEventListener("wheel", handleWheel);
  }, [chartIsMounted]);

  // Applies the scrollLeft computed above, once (after this render commits
  // the new, zoomed day-column width to the DOM) rather than at wheel time —
  // otherwise it would be computed and clamped against the OLD width.
  // biome-ignore lint/correctness/useExhaustiveDependencies: zoom is listed to force this to run right after the zoomed grid commits; the body itself only reads the pending-scroll ref.
  useLayoutEffect(() => {
    const pending = pendingScrollLeftRef.current;
    if (pending == null) return;
    pendingScrollLeftRef.current = null;
    const scrollEl = scrollContainerRef.current;
    if (scrollEl) scrollEl.scrollLeft = pending;
  }, [zoom]);

  // ResizeObserver only fires on a *size* change, but toggling the task rail
  // (mobile Hide/Show, or crossing the mobile breakpoint) changes the
  // track's left offset without changing its size — so showTaskRail and
  // isMobile are listed here purely to force a re-measure of offsetLeft on
  // those transitions, the same way measureRows lists its own layout inputs
  // below. Depending on `range` rather than the full `timeline` means this
  // effect (and the observer it (re)creates) doesn't tear down and rebuild
  // on every zoom step — the day *count* only changes with `range`, and the
  // observer it sets up here keeps reporting live `clientWidth` changes
  // (including the ones zoom itself causes) without needing to be
  // recreated.
  // biome-ignore lint/correctness/useExhaustiveDependencies: showTaskRail/isMobile force a re-measure on rail-position changes; see comment above.
  useLayoutEffect(() => {
    const element = timelineTrackRef.current;
    if (!element || !range) return;

    const update = () => {
      const count = range.days.length;
      if (count <= 0) return;
      setPixelsPerDay(element.clientWidth / count);
      setBarsLeftPx(element.offsetLeft);
      barsLeftPxRef.current = element.offsetLeft;
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [range, showTaskRail, isMobile]);

  const measureRows = useCallback(() => {
    const next = new Map<string, { top: number; height: number }>();
    for (const [taskId, element] of rowElementsRef.current) {
      next.set(taskId, {
        top: element.offsetTop,
        height: element.offsetHeight,
      });
    }
    setRowLayout((current) => {
      // A `Map` is a new reference every measurement, which would otherwise
      // force a render on every effect run (including ones triggered by
      // unrelated re-renders, e.g. `project` data getting a fresh reference
      // from the query cache). Bailing out on unchanged content keeps this
      // from re-rendering — or re-triggering ResizeObserver-driven effects —
      // when nothing actually moved.
      if (current.size === next.size) {
        let unchanged = true;
        for (const [taskId, box] of next) {
          const previous = current.get(taskId);
          if (
            !previous ||
            previous.top !== box.top ||
            previous.height !== box.height
          ) {
            unchanged = false;
            break;
          }
        }
        if (unchanged) return current;
      }
      return next;
    });
  }, []);

  // Row heights depend on task-rail content, not a fixed rhythm, so they're
  // measured directly rather than derived from an index. Re-measure whenever
  // the visible rows themselves could have changed (search, timeline window,
  // rail layout) and via ResizeObserver for organic content changes (font
  // load, text wrapping) the dependency list above wouldn't catch. `range`
  // rather than `timeline`, since row height doesn't depend on the zoomed
  // day-column width, only on which window/rows are showing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: measureRows reads rowElementsRef (a plain ref, not a reactive value), so these are listed to force a re-measure whenever they could change row layout, not because the effect body reads them directly.
  useLayoutEffect(() => {
    measureRows();
  }, [measureRows, renderedTasks, range, showTaskRail, isMobile]);

  useEffect(() => {
    const element = rowsContainerRef.current;
    if (!element) return;
    const observer = new ResizeObserver(measureRows);
    observer.observe(element);
    return () => observer.disconnect();
  }, [measureRows]);

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
      (scheduledTasks.length === 0 &&
        visibleExternalRelatedTasks.length === 0) ||
      !todayCellRef.current
    )
      return;
    hasCenteredOnTodayRef.current = true;
    scrollToToday("auto");
  }, [
    todayInRange,
    scrollToToday,
    projectId,
    scheduledTasks.length,
    visibleExternalRelatedTasks.length,
  ]);

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
              {dependencyEdgeGeometry.length > 0 && (
                <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <span className="h-0.5 w-4 rounded-full bg-destructive" />
                    {t("tasks:gantt.legendBlocking")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-0.5 w-4 rounded-full bg-muted-foreground" />
                    {t("tasks:gantt.legendRelated")}
                  </span>
                  {showCriticalPath &&
                    criticalPath &&
                    criticalPath.criticalTaskIds.size > 0 && (
                      <span className="flex items-center gap-1">
                        <span className="h-0.5 w-4 rounded-full bg-warning" />
                        {t("tasks:gantt.legendCriticalPath")}
                      </span>
                    )}
                </div>
              )}
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
              className={cn(
                "min-h-11 touch-manipulation sm:min-h-0",
                showCriticalPath &&
                  "border-warning/40 bg-warning/10 text-warning-foreground hover:bg-warning/15",
              )}
              aria-pressed={showCriticalPath}
              aria-label={t("tasks:gantt.criticalPathToggleAriaLabel")}
              onClick={() => setShowCriticalPath(!showCriticalPath)}
            >
              <RouteIcon className="size-3.5" />
              {t("tasks:gantt.criticalPathToggle")}
            </Button>

            <fieldset className="flex shrink-0 items-center gap-0.5 rounded-md border border-border bg-background p-0.5">
              <legend className="sr-only">
                {t("tasks:gantt.unitControlAriaLabel")}
              </legend>
              {GANTT_UNITS.map((unit) => (
                <button
                  key={unit}
                  type="button"
                  aria-pressed={ganttUnit === unit}
                  onClick={() => handleUnitChange(unit)}
                  className={cn(
                    "min-h-9 touch-manipulation rounded-sm px-2.5 py-1 text-xs font-medium transition-colors sm:min-h-0",
                    ganttUnit === unit
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {t(GANTT_UNIT_LABEL_KEYS[unit])}
                </button>
              ))}
            </fieldset>

            {timeline && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("tasks:gantt.previousPeriod")}
                  disabled={!timeline.hasPrevious}
                  onClick={() =>
                    showDate(addDays(timeline.rangeStart, -timeline.windowDays))
                  }
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <input
                  type="date"
                  aria-label={t("tasks:gantt.periodStart")}
                  className="h-9 rounded-md border border-border bg-background px-2 text-sm"
                  min={format(timeline.minimumStart, "yyyy-MM-dd")}
                  max={format(timeline.maximumStart, "yyyy-MM-dd")}
                  value={format(timeline.rangeStart, "yyyy-MM-dd")}
                  onChange={(event) => {
                    const date = parseTaskDate(event.target.value);
                    if (date) showDate(date);
                  }}
                />
                <span className="text-xs text-muted-foreground">
                  – {format(timeline.rangeEnd, "MMM d, yyyy")}
                </span>
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("tasks:gantt.nextPeriod")}
                  disabled={!timeline.hasNext}
                  onClick={() =>
                    showDate(addDays(timeline.rangeStart, timeline.windowDays))
                  }
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            )}

            <Button
              variant="outline"
              size="xs"
              className="min-h-11 touch-manipulation sm:min-h-0"
              onClick={() => scrollToToday()}
              disabled={
                !todayInRange ||
                (scheduledTasks.length === 0 &&
                  visibleExternalRelatedTasks.length === 0)
              }
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

        {!timeline ||
        (parsedTasks.length === 0 && externalRelatedTasks.length === 0) ? (
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
        ) : scheduledTasks.length === 0 &&
          visibleExternalRelatedTasks.length === 0 ? (
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
            ref={scrollContainerRef}
            data-testid="gantt-scroll-container"
            className="min-h-0 flex-1 overflow-auto overscroll-x-contain [-webkit-overflow-scrolling:touch]"
            style={{ scrollPaddingLeft: `${scrollPaddingLeftRem}rem` }}
          >
            <div
              ref={chartRootRef}
              className={cn(
                "relative min-w-max touch-pan-x touch-pan-y",
                isPanning ? "cursor-grabbing" : "cursor-grab",
              )}
              onPointerDown={handleChartPointerDown}
              onPointerMove={handleChartPointerMove}
              onPointerUp={endChartPan}
              onPointerCancel={endChartPan}
            >
              <div className="sticky top-0 z-20 flex border-b border-border bg-background/95 backdrop-blur">
                {showTaskRail ? (
                  <div
                    data-gantt-rail=""
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
                  {ganttUnit === "day"
                    ? timeline.days.map((day, index) => {
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
                              !workingDayPredicate(day) && "bg-muted",
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
                      })
                    : // Week/Month/Quarter: one grouped cell per header column,
                      // spanning that column's day-tracks (see
                      // buildGanttHeaderColumns) rather than one cell per day —
                      // the day-tracks underneath still exist for bar/line
                      // positioning, they're just not individually labeled here.
                      headerColumns.map((column) => {
                        const columnDays = timeline.days.slice(
                          column.startIndex,
                          column.endIndex + 1,
                        );
                        const containsToday = columnDays.some((day) =>
                          isToday(day),
                        );

                        return (
                          <div
                            key={`${column.startIndex}-${column.label}`}
                            ref={containsToday ? todayCellRef : undefined}
                            style={{
                              gridColumn: `${column.startIndex + 1} / ${column.endIndex + 2}`,
                            }}
                            className={cn(
                              "flex items-center justify-center border-r border-border/70 px-1 py-2 text-center text-xs font-medium",
                              containsToday
                                ? "text-foreground"
                                : "text-muted-foreground",
                            )}
                          >
                            {containsToday ? (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-primary-foreground">
                                {column.label}
                              </span>
                            ) : (
                              column.label
                            )}
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
                  {timeline.days.map((day, index) => (
                    <div
                      key={`bg-line-${day.toISOString()}`}
                      className={cn(
                        "h-full min-h-0",
                        // A divider only at the END of each header column (see
                        // buildGanttHeaderColumns) — every day for Day (where
                        // every day IS its own column), but only between
                        // weeks/months/quarters at coarser units, so the
                        // background doesn't turn into a wall of day lines
                        // once each column covers dozens of days.
                        headerColumnEndIndices.has(index) &&
                          "border-r border-border/60",
                        // Non-working-day tint (weekend per the workspace's
                        // bitmask, or a holiday) is only meaningful at Day
                        // granularity — at Week/Month/Quarter it would render
                        // as a sliver a fraction of a pixel wide.
                        ganttUnit === "day" &&
                          !workingDayPredicate(day) &&
                          "bg-muted",
                      )}
                    />
                  ))}
                </div>

                <div
                  ref={rowsContainerRef}
                  className="relative z-10 flex flex-col"
                >
                  <GanttDependencyOverlay
                    edges={dependencyEdgeGeometry}
                    hoveredTaskId={hoveredTaskId}
                    criticalEdgeIds={criticalPath?.criticalEdgeIds}
                    clipLeftPx={barsLeftPx}
                    preview={
                      linkDrag
                        ? {
                            source: linkDrag.sourcePoint,
                            pointer: linkDrag.pointerPoint,
                          }
                        : null
                    }
                  />
                  {renderedTasks.map((task) => {
                    return (
                      <div
                        key={task.id}
                        ref={(element) => {
                          if (element) {
                            rowElementsRef.current.set(task.id, element);
                          } else {
                            rowElementsRef.current.delete(task.id);
                          }
                        }}
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
                          <div
                            data-gantt-rail=""
                            className="sticky left-0 z-[11] h-full border-r border-border bg-background"
                          >
                            {task.isExternal ? (
                              <div className="flex min-h-[44px] w-full min-w-0 flex-col items-start justify-center gap-0.5 px-2 py-2 text-left opacity-80 sm:min-h-0 sm:px-3 sm:py-1.5">
                                <div className="flex w-full items-center gap-1.5">
                                  <span className="max-w-[7rem] truncate rounded-full bg-secondary/60 px-1.5 py-px text-[10px] font-medium uppercase tracking-wide text-secondary-foreground sm:max-w-none">
                                    {task.projectSlug}
                                    {task.number ? `-${task.number}` : ""}
                                  </span>
                                  <span className="truncate text-[10px] text-muted-foreground">
                                    {t("tasks:gantt.externalProjectBadge", {
                                      projectName: task.projectName,
                                    })}
                                  </span>
                                </div>
                                <p className="w-full line-clamp-1 text-xs font-medium leading-tight text-muted-foreground">
                                  {task.title}
                                </p>
                                <p className="w-full truncate text-[11px] leading-tight text-muted-foreground">
                                  {format(task.scheduleStart, "MMM d, yyyy")} -{" "}
                                  {format(task.scheduleEnd, "MMM d, yyyy")}
                                </p>
                              </div>
                            ) : (
                              <div className="flex w-full min-w-0 items-stretch">
                                {childOwnTasksByParentId.has(task.id) ? (
                                  <button
                                    type="button"
                                    aria-expanded={
                                      !collapsedParentIds.has(task.id)
                                    }
                                    aria-label={
                                      collapsedParentIds.has(task.id)
                                        ? t("tasks:gantt.expandSubtasks")
                                        : t("tasks:gantt.collapseSubtasks")
                                    }
                                    onClick={() =>
                                      toggleParentCollapsed(task.id)
                                    }
                                    className="flex min-h-[44px] shrink-0 touch-manipulation items-center justify-center self-stretch px-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-h-0"
                                  >
                                    <ChevronDown
                                      className={cn(
                                        "size-3.5 transition-transform",
                                        collapsedParentIds.has(task.id) &&
                                          "-rotate-90",
                                      )}
                                    />
                                  </button>
                                ) : isNestedChild(task) ? (
                                  // Indent spacer: a one-level child has no
                                  // chevron of its own (see the
                                  // one-level-of-nesting limit in
                                  // gantt-hierarchy.ts), but still steps its
                                  // title in under its parent's. A child
                                  // whose parent the search filtered out
                                  // (isNestedChild is false) skips this and
                                  // renders like an ordinary top-level row —
                                  // see the isNestedChild comment above.
                                  <span
                                    aria-hidden="true"
                                    className="w-4 shrink-0"
                                  />
                                ) : null}
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
                                    {format(task.scheduleStart, "MMM d, yyyy")}{" "}
                                    - {format(task.scheduleEnd, "MMM d, yyyy")}
                                    {task.assigneeName
                                      ? ` • ${task.assigneeName}`
                                      : ""}
                                  </p>
                                </button>
                              </div>
                            )}
                            {(task.scheduleEnd < timeline.rangeStart ||
                              task.scheduleStart > timeline.rangeEnd) && (
                              <button
                                type="button"
                                className="px-3 pb-2 text-xs text-primary underline"
                                onClick={() =>
                                  showDate(addDays(task.scheduleStart, -7))
                                }
                              >
                                {t("tasks:gantt.showTaskDates")}
                              </button>
                            )}
                          </div>
                        ) : null}

                        <div
                          className={cn(
                            "relative shrink-0 select-none",
                            // Extra room below the bar for the baseline
                            // underlay (see GanttTaskBar); rows without a
                            // baseline stay at the usual height. A summary
                            // row never renders one (see GanttSummaryTaskBar)
                            // regardless of the parent's own baseline dates.
                            !task.isExternal &&
                              !task.isSummary &&
                              (task.baselineStartDate || task.baselineDueDate)
                              ? "min-h-14"
                              : "min-h-11",
                          )}
                          style={{
                            minWidth: `${timeline.timelineMinWidthRem}rem`,
                          }}
                        >
                          {task.isExternal ? (
                            <GanttExternalTaskBar
                              task={task}
                              timeline={timeline}
                              emphasis={emphasisFor(task.id)}
                              onHoverChange={(hovering) =>
                                handleBarHoverChange(task.id, hovering)
                              }
                            />
                          ) : task.isSummary ? (
                            <GanttSummaryTaskBar
                              title={task.title}
                              scheduleStart={task.scheduleStart}
                              scheduleEnd={task.scheduleEnd}
                              timeline={timeline}
                              emphasis={emphasisFor(task.id)}
                              isCritical={isCriticalFor(task.id)}
                              onHoverChange={(hovering) =>
                                handleBarHoverChange(task.id, hovering)
                              }
                              onOpenTask={() =>
                                navigate({
                                  to: ".",
                                  search: { taskId: task.id },
                                  replace: true,
                                })
                              }
                            />
                          ) : (
                            <GanttTaskBar
                              task={task}
                              timeline={timeline}
                              pixelsPerDay={pixelsPerDay}
                              isMobile={isMobile}
                              emphasis={emphasisFor(task.id)}
                              isCritical={isCriticalFor(task.id)}
                              onHoverChange={(hovering) =>
                                handleBarHoverChange(task.id, hovering)
                              }
                              onOpenTask={() =>
                                navigate({
                                  to: ".",
                                  search: { taskId: task.id },
                                  replace: true,
                                })
                              }
                              onLinkDragStart={handleLinkDragStart}
                              onDatesCommitted={handleTaskDatesCommitted}
                            />
                          )}
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
