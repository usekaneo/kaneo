import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { addDays, format, isSameMonth, isToday, isWeekend } from "date-fns";
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
import type {
  DependencyEdgeInput,
  TaskBarBox,
} from "@/components/gantt/dependency-lines";
import { buildDependencyEdges } from "@/components/gantt/dependency-lines";
import { GanttDependencyOverlay } from "@/components/gantt/gantt-dependency-overlay";
import type { ExternalGanttTask } from "@/components/gantt/gantt-external-task-bar";
import { GanttExternalTaskBar } from "@/components/gantt/gantt-external-task-bar";
import { GanttTaskBar } from "@/components/gantt/gantt-task-bar";
import { computePanScrollPosition } from "@/components/gantt/pan";
import {
  buildGanttGridMetrics,
  buildGanttRange,
  deriveTaskSchedule,
  GANTT_WINDOW_DAYS,
  getBarGridColumns,
  parseTaskDate,
} from "@/components/gantt/timeline";
import {
  nextGanttZoom,
  normalizeWheelDeltaY,
  scrollLeftForZoom,
} from "@/components/gantt/zoom";
import PageTitle from "@/components/page-title";
import TaskDetailsSheet from "@/components/task/task-details-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useGetTasks } from "@/hooks/queries/task/use-get-tasks";
import useGetProjectTaskRelations from "@/hooks/queries/task-relation/use-get-project-task-relations";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/cn";
import { getStatusLabel } from "@/lib/i18n/domain";
import { useUserPreferencesStore } from "@/store/user-preferences";
import type Task from "@/types/task";

type GanttSearchParams = {
  taskId?: string;
};

type OwnScheduledTask = Task & {
  scheduleStart: Date;
  scheduleEnd: Date;
  isExternal: false;
};

type ExternalScheduledTask = ExternalGanttTask & { isExternal: true };

// A Gantt row is either one of this project's own tasks or a related task
// pulled in from another project (see `externalRelatedTasks` below) — the
// discriminant lets the row-rendering loop pick the right bar and rail cell
// without a type assertion.
type GanttRowTask = OwnScheduledTask | ExternalScheduledTask;

// Bars render with `mx-1` (0.25rem — see gantt-task-bar.tsx /
// gantt-external-task-bar.tsx), so the visible edge sits inset from the
// grid-column boundary a box's left/right are otherwise measured against;
// without this a dependency line lands a few pixels short of (or past) the
// bar it's supposed to touch. 0.25rem scales with the root font size, so
// the inset is measured from it rather than assumed to be the default 16px
// (4px) — otherwise it drifts out of alignment under a non-default
// browser/OS font-size setting.
function getBarEdgeInsetPx(): number {
  if (typeof document === "undefined") return 4;
  const rootFontSizePx = Number.parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  return (Number.isFinite(rootFontSizePx) ? rootFontSizePx : 16) * 0.25;
}

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
  const weekStartsOn = useUserPreferencesStore((state) => state.weekStartsOn);
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
  const baseDayColumnWidthRem = isMobile ? 3.125 : 2.75;
  // Mouse-wheel zoom scales the base width by this factor (see the wheel
  // listener below); 1 is the default, unzoomed scale.
  const [zoom, setZoom] = useState(1);
  const dayColumnWidthRem = baseDayColumnWidthRem * zoom;
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

  const parsedTasks = useMemo<OwnScheduledTask[]>(() => {
    return allTasks
      .map((task) => {
        const schedule = deriveTaskSchedule(task.startDate, task.dueDate);
        if (!schedule) return null;

        return {
          ...task,
          scheduleStart: schedule.start,
          scheduleEnd: schedule.end,
          isExternal: false as const,
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

  // The date window (which 91 days are in view, and the paging bounds
  // around them) depends only on the task list, the week-start preference,
  // and which page is requested — never on the zoomed day-column width.
  // Keeping it in its own memo means `range.days` (and its 91 Date objects)
  // stays referentially stable across zoom changes, so wheel-zooming
  // doesn't rebuild the whole date range on every notch; only the grid
  // metrics below (a string template and a multiplication) actually need to
  // recompute with the zoomed width.
  const range = useMemo(
    () => buildGanttRange(parsedTasks, weekStartsOn, requestedStart),
    [parsedTasks, weekStartsOn, requestedStart],
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

  // Whether "today" actually falls inside the computed date range. A project
  // made up entirely of past or far-future tasks has no "today" column to
  // jump to, so the button below is disabled in that case instead of doing
  // nothing silently.
  const todayInRange = useMemo(
    () => range?.days.some((day) => isToday(day)) ?? false,
    [range],
  );

  // "subtask" relations describe hierarchy, not scheduling dependency, and
  // the task rail already communicates hierarchy elsewhere; drawing lines
  // for them here would only clutter the chart, so only "blocks" and
  // "related" become dependency edges.
  const { data: taskRelations } = useGetProjectTaskRelations(projectId);
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
        },
      ];
    });
  }, [taskRelations]);

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
          isExternal: true as const,
        });
      }
    }
    return [...external.values()];
  }, [taskRelations, projectId]);

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

  // Every row the grid actually draws: this project's own (search-filtered)
  // tasks plus the (also search-aware, see above) external related tasks, in
  // one chronological list so the two kinds of rows interleave by date
  // rather than externals always trailing at the bottom. When the search
  // matches zero own tasks, this is empty too (no own task is "visible" to
  // connect an external row to), so the "no tasks found" state below and the
  // chart's row list agree on when there's nothing to show.
  const renderedTasks = useMemo<GanttRowTask[]>(() => {
    return [...scheduledTasks, ...visibleExternalRelatedTasks].sort(
      (left, right) =>
        left.scheduleStart.getTime() - right.scheduleStart.getTime(),
    );
  }, [scheduledTasks, visibleExternalRelatedTasks]);

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
      const { barInView, lineStart, lineEnd } = getBarGridColumns(
        task.scheduleStart,
        task.scheduleEnd,
        timeline.rangeStart,
        trackCount,
      );
      if (!barInView) continue;
      boxes.set(task.id, {
        left: barsLeftPx + (lineStart - 1) * pixelsPerDay + barEdgeInsetPx,
        right: barsLeftPx + (lineEnd - 1) * pixelsPerDay - barEdgeInsetPx,
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
  // once it appears, e.g. after tasks finish loading.
  const chartIsMounted = Boolean(timeline) && scheduledTasks.length > 0;

  // A pointerdown here should start a drag-to-pan only when it lands on
  // genuinely empty timeline background or the day-header — not on a task
  // bar (which has its own drag-to-move/resize), the sticky task rail, or
  // any other interactive control. Task-bar handles are `<button>`s, so
  // matching `button`/`input`/`a`/`[role="button"]` already excludes them
  // without needing to know anything about the bar itself.
  const isPannableTarget = useCallback((target: EventTarget | null) => {
    if (!(target instanceof Element)) return true;
    return !target.closest(
      'button, input, a, [role="button"], [data-gantt-rail]',
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
  // drag-to-pan.
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

            {timeline && (
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  size="icon-sm"
                  aria-label={t("tasks:gantt.previousPeriod")}
                  disabled={!timeline.hasPrevious}
                  onClick={() =>
                    showDate(addDays(timeline.rangeStart, -GANTT_WINDOW_DAYS))
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
                    showDate(addDays(timeline.rangeStart, GANTT_WINDOW_DAYS))
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

                <div
                  ref={rowsContainerRef}
                  className="relative z-10 flex flex-col"
                >
                  <GanttDependencyOverlay
                    edges={dependencyEdgeGeometry}
                    hoveredTaskId={hoveredTaskId}
                    clipLeftPx={barsLeftPx}
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
                                  {format(task.scheduleStart, "MMM d, yyyy")} -{" "}
                                  {format(task.scheduleEnd, "MMM d, yyyy")}
                                  {task.assigneeName
                                    ? ` • ${task.assigneeName}`
                                    : ""}
                                </p>
                              </button>
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
                          className="relative min-h-11 shrink-0 select-none"
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
                          ) : (
                            <GanttTaskBar
                              task={task}
                              timeline={timeline}
                              pixelsPerDay={pixelsPerDay}
                              isMobile={isMobile}
                              emphasis={emphasisFor(task.id)}
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
