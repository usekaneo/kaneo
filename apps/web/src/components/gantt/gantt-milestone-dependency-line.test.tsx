import { cleanup, render } from "@testing-library/react";
import { parseISO } from "date-fns";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildGanttRange, getBarGridColumns } from "./timeline";

// Regression coverage for the milestone dependency-line box bug: a
// milestone task's dependency-line anchor must come from its diamond POINT
// (scheduleStart only), not the full scheduleStart..scheduleEnd span it
// still carries from before it was marked a milestone (or was never
// cleared) — see the `taskBoxes` memo in the Gantt route. Renders the real
// route end-to-end (not a mocked GanttTaskBar), same harness pattern as
// gantt-dependency-line-rendering.test.tsx. Every row's rendered height/top
// are stubbed identically (jsdom lays out nothing), so both bars land on
// the same vertical center and the connector is always the "same row"
// straight line `M sourceX sourceY L targetX targetY` — which conveniently
// puts the milestone's own box.right directly in the path string, letting
// the assertions below compare it against an independently-recomputed
// expected (point-based) and buggy (span-based) x position without
// duplicating the Gantt route's own layout math.
const m = vi.hoisted(() => ({
  component: (() => null) as ComponentType,
  milestoneTask: {
    id: "task-milestone",
    projectId: "project",
    title: "Ship v1",
    number: 1,
    status: "to-do",
    // A wide start/due span, as if it still carried both dates from before
    // being marked a milestone (or the person set them once and later
    // toggled the milestone flag without clearing dueDate) — the diamond
    // itself always renders at scheduleStart only (see GanttTaskBar), so the
    // dependency line must anchor there too, not at this wide span's end.
    startDate: "2026-08-10",
    dueDate: "2026-09-20",
    isMilestone: true,
    description: "",
    labels: [],
    priority: "low",
    position: 1,
  },
  targetTask: {
    id: "task-target",
    projectId: "project",
    title: "Follow-up work",
    number: 2,
    status: "to-do",
    startDate: "2026-08-23",
    dueDate: "2026-08-29",
    isMilestone: false,
    description: "",
    labels: [],
    priority: "low",
    position: 2,
  },
  preferencesState: {
    weekStartsOn: 1 as const,
    ganttTimelineUnit: "day" as const,
    setGanttTimelineUnit: (() => {}) as (unit: string) => void,
  },
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: { component: ComponentType }) => {
    m.component = options.component;
    return {
      useParams: () => ({ projectId: "project", workspaceId: "workspace" }),
      useSearch: () => ({}),
    };
  },
  useNavigate: () => vi.fn(),
}));
vi.mock("@/components/common/project-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => ({
    data: {
      id: "project",
      name: "Project",
      slug: "PROJ",
      columns: [{ tasks: [m.milestoneTask, m.targetTask] }],
      plannedTasks: [],
    },
  }),
}));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task/use-bulk-update-task-schedule", () => ({
  useBulkUpdateTaskSchedule: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task-relation/use-create-task-relation", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: () => ({
    data: [
      {
        id: "relation-1",
        sourceTaskId: "task-milestone",
        targetTaskId: "task-target",
        relationType: "blocks",
        createdAt: "2026-08-01T00:00:00.000Z",
        sourceTask: {
          id: "task-milestone",
          title: "Ship v1",
          status: "to-do",
          priority: "low",
          number: 1,
          projectId: "project",
          projectName: "Project",
          projectSlug: "PROJ",
          userId: null,
          assigneeName: null,
          startDate: m.milestoneTask.startDate,
          dueDate: m.milestoneTask.dueDate,
        },
        targetTask: {
          id: "task-target",
          title: "Follow-up work",
          status: "to-do",
          priority: "low",
          number: 2,
          projectId: "project",
          projectName: "Project",
          projectSlug: "PROJ",
          userId: null,
          assigneeName: null,
          startDate: m.targetTask.startDate,
          dueDate: m.targetTask.dueDate,
        },
      },
    ],
  }),
}));
vi.mock("@/hooks/queries/calendar/use-get-calendar", () => ({
  default: () => ({ data: undefined }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (
    selector: (state: typeof m.preferencesState) => unknown,
  ) => selector(m.preferencesState),
}));
vi.mock("@/lib/i18n/domain", () => ({
  getStatusLabel: (status: string) => status,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options ? `${key}:${JSON.stringify(options)}` : key,
  }),
  initReactI18next: { type: "3rdParty", init: vi.fn() },
}));
vi.mock("@/lib/toast", () => ({ toast: { error: vi.fn() } }));

await import(
  "@/routes/_layout/_authenticated/dashboard/workspace/$workspaceId/project/$projectId/gantt"
);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 7, 24));
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  Object.defineProperty(HTMLElement.prototype, "scrollIntoView", {
    configurable: true,
    value: vi.fn(),
  });
  // Same jsdom layout stand-in as gantt-dependency-line-rendering.test.tsx.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 910,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get: () => 320,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetTop", {
    configurable: true,
    get: () => 0,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetHeight", {
    configurable: true,
    get: () => 44,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  for (const prop of [
    "clientWidth",
    "offsetLeft",
    "offsetTop",
    "offsetHeight",
  ] as const) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
  }
});

function show() {
  const Component = m.component;
  return render(<Component />);
}

describe("Gantt dependency line anchored on a milestone", () => {
  it("anchors the connector at the milestone's diamond point, not its wide start/due span", () => {
    const { container } = show();

    const paths = container.querySelectorAll("svg path[stroke]");
    expect(paths).toHaveLength(1);
    const d = paths[0]?.getAttribute("d") ?? "";
    const [, sourceXRaw] = d.match(/^M ([\d.-]+) /) ?? [];
    const sourceX = Number(sourceXRaw);
    expect(Number.isNaN(sourceX)).toBe(false);

    // Recompute the expected (point-based, fixed) and buggy (span-based) x
    // positions independently, via the same pure timeline.ts helpers the
    // route itself uses — but never importing the route's own taskBoxes
    // logic, so this can't accidentally just mirror the bug.
    const milestoneStart = parseISO(m.milestoneTask.startDate);
    const milestoneEnd = parseISO(m.milestoneTask.dueDate);
    const targetStart = parseISO(m.targetTask.startDate);
    const targetEnd = parseISO(m.targetTask.dueDate);
    const range = buildGanttRange(
      [
        { scheduleStart: milestoneStart, scheduleEnd: milestoneEnd },
        { scheduleStart: targetStart, scheduleEnd: targetEnd },
      ],
      1,
      null,
      new Date(2026, 7, 24),
      "day",
    );
    expect(range).not.toBeNull();
    const trackCount = range?.days.length ?? 0;
    const barsLeftPx = 320; // offsetLeft stub above
    const pixelsPerDay = 910 / trackCount; // clientWidth stub above

    const pointBased = getBarGridColumns(
      milestoneStart,
      milestoneStart,
      range?.rangeStart ?? milestoneStart,
      trackCount,
    );
    const spanBased = getBarGridColumns(
      milestoneStart,
      milestoneEnd,
      range?.rangeStart ?? milestoneStart,
      trackCount,
    );
    const pointBasedRightPx =
      barsLeftPx + (pointBased.lineEnd - 1) * pixelsPerDay;
    const spanBasedRightPx =
      barsLeftPx + (spanBased.lineEnd - 1) * pixelsPerDay;

    // The two candidates are meaningfully far apart (Aug 10 vs. Sep 20, ~41
    // days), so a small inset/clamp difference can't make them collide.
    expect(Math.abs(pointBasedRightPx - spanBasedRightPx)).toBeGreaterThan(
      100,
    );
    // The actual rendered connector must land near the POINT-based edge...
    expect(Math.abs(sourceX - pointBasedRightPx)).toBeLessThan(10);
    // ...and nowhere near the buggy, span-based one.
    expect(Math.abs(sourceX - spanBasedRightPx)).toBeGreaterThan(100);
  });
});
