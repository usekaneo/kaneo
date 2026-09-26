import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// End-to-end proof that a drag from one bar's link handle onto another bar
// creates a "blocks" relation, and that dropping on empty space or the
// source bar itself is a no-op — same rendering harness as
// gantt-pan-zoom.test.tsx (a real render, with layout measurements stubbed
// the way jsdom otherwise never provides).
const m = vi.hoisted(() => ({
  component: (() => null) as ComponentType,
  preferencesState: {
    weekStartsOn: 1 as const,
    ganttTimelineUnit: "day" as const,
    setGanttTimelineUnit: (() => {}) as (unit: string) => void,
  },
}));

const createRelation = vi.hoisted(() => ({
  mutateAsync: vi.fn().mockResolvedValue({ id: "relation-1" }),
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
      columns: [
        {
          tasks: [
            {
              id: "task-a",
              projectId: "project",
              title: "Design API",
              number: 1,
              status: "to-do",
              startDate: "2026-08-20",
              dueDate: "2026-08-21",
              description: "",
              labels: [],
              priority: "low",
              position: 1,
            },
            {
              id: "task-b",
              projectId: "project",
              title: "Implement API",
              number: 2,
              status: "to-do",
              startDate: "2026-08-25",
              dueDate: "2026-08-26",
              description: "",
              labels: [],
              priority: "low",
              position: 2,
            },
          ],
        },
      ],
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
  default: () => createRelation,
}));
const relationsMock = vi.hoisted(() => ({ data: [] as unknown[] }));
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: () => relationsMock,
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
  // Options are folded into the returned string (rather than dropped, as a
  // plain `(key) => key` mock would) so aria-labels stay unique per task —
  // this test needs to tell task A's link handle apart from task B's, both
  // of which share the same i18n key.
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

function show() {
  const Component = m.component;
  return render(<Component />);
}

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
  // Same measurement stubs as gantt-dependency-line-rendering.test.tsx: jsdom
  // never lays anything out, so these give every row/bar the pixel
  // dimensions the link-drag's own hit-testing (findLinkDropTarget) reads.
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
  Object.defineProperty(HTMLElement.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => ({
      left: 0,
      top: 0,
      right: 910,
      bottom: 600,
      width: 910,
      height: 600,
      x: 0,
      y: 0,
      toJSON() {},
    }),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  relationsMock.data = [];
  createRelation.mutateAsync.mockClear();
  for (const prop of [
    "clientWidth",
    "offsetLeft",
    "offsetTop",
    "offsetHeight",
    "getBoundingClientRect",
  ]) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
  }
});

// With "today" stubbed to Aug 24 2026, the timeline opens 7 days before the
// Monday of task-a's own week — Mon Aug 10 2026 (buildGanttRange's
// ownMinimumStart) — and, since both tasks sit close together, closes 28
// days after the Sunday ending task-b's week (ownMaximumEnd) rather than the
// full 91-day default window: Sun Sep 27 2026, 49 days in. With
// clientWidth=910 (stub) that's pixelsPerDay=910/49≈18.571. task-a (Aug
// 20-21, day-offsets 10-11) lands on grid lines 11/13, i.e. the pixel box
// [320+10*18.571, 320+12*18.571] before the ~4px edge inset —
// [509.7, 538.9] after it (barsLeftPx=320 from the offsetLeft stub,
// computeInsetBarBox, 4px from the stubbed 16px root font size). task-b (Aug
// 25-26, offsets 15-16) lands on grid lines 16/18: [602.6, 631.7]. Points
// below are chosen well inside each box, and in the gap between them for
// "empty space".
const TASK_A_X = 520;
const TASK_B_X = 615;
const EMPTY_SPACE_X = 570;

function getLinkHandle(taskTitle: string) {
  return screen.getByRole("button", {
    name: `tasks:gantt.linkHandleAriaLabel:${JSON.stringify({ title: taskTitle })}`,
  });
}

describe("Gantt link-drag (drag to create a dependency)", () => {
  it("creates a blocks relation when dragged from task A's handle and dropped onto task B's bar", () => {
    show();
    const handle = getLinkHandle("Design API");

    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 10,
      clientX: TASK_A_X,
      clientY: 40,
    });
    fireEvent.pointerMove(window, {
      pointerId: 10,
      clientX: TASK_B_X,
      clientY: 40,
    });
    // A dashed preview line is visible mid-drag.
    expect(
      document.querySelector('[data-testid="gantt-link-preview"]'),
    ).toBeTruthy();

    fireEvent.pointerUp(window, {
      pointerId: 10,
      clientX: TASK_B_X,
      clientY: 40,
    });

    expect(createRelation.mutateAsync).toHaveBeenCalledTimes(1);
    expect(createRelation.mutateAsync).toHaveBeenCalledWith({
      sourceTaskId: "task-a",
      targetTaskId: "task-b",
      relationType: "blocks",
      dependencyType: "fs",
      lagDays: 0,
    });
    // The preview line is gone once the gesture ends.
    expect(
      document.querySelector('[data-testid="gantt-link-preview"]'),
    ).toBeNull();
  });

  it("does not create a relation when dropped on empty space", () => {
    show();
    const handle = getLinkHandle("Design API");

    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 11,
      clientX: TASK_A_X,
      clientY: 40,
    });
    fireEvent.pointerUp(window, {
      pointerId: 11,
      clientX: EMPTY_SPACE_X,
      clientY: 40,
    });

    expect(createRelation.mutateAsync).not.toHaveBeenCalled();
  });

  it("does not create a relation when dropped back on the source bar itself", () => {
    show();
    const handle = getLinkHandle("Design API");

    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 12,
      clientX: TASK_A_X,
      clientY: 40,
    });
    fireEvent.pointerUp(window, {
      pointerId: 12,
      clientX: TASK_A_X,
      clientY: 40,
    });

    expect(createRelation.mutateAsync).not.toHaveBeenCalled();
  });

  it("does not start a bar move/pan from the link handle's pointerdown", () => {
    const { container } = show();
    const scrollContainer = screen.getByTestId("gantt-scroll-container");
    scrollContainer.scrollLeft = 200;
    const handle = getLinkHandle("Design API");

    fireEvent.pointerDown(handle, {
      button: 0,
      pointerId: 13,
      clientX: TASK_A_X,
      clientY: 40,
    });
    fireEvent.pointerMove(container, {
      pointerId: 13,
      pointerType: "mouse",
      clientX: TASK_B_X,
      clientY: 40,
    });

    // Neither the bar's own drag-to-move nor the chart's drag-to-pan engaged.
    expect(scrollContainer.scrollLeft).toBe(200);
  });
});
