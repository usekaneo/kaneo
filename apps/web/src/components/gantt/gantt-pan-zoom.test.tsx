import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// End-to-end proof that the wheel-zoom and drag-to-pan wiring on the Gantt
// route actually reaches the DOM: a real render (not a mocked task bar),
// with layout measurements stubbed the same way
// gantt-dependency-line-rendering.test.tsx does, since jsdom never lays
// anything out on its own.
const m = vi.hoisted(() => ({
  component: (() => null) as ComponentType,
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
              dueDate: "2026-08-25",
              description: "",
              labels: [],
              priority: "low",
              position: 1,
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
  default: () => ({ mutateAsync: vi.fn() }),
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
  useTranslation: () => ({ t: (key: string) => key }),
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
  // jsdom doesn't lay anything out; give the elements the wheel/pan handlers
  // actually read (scrollLeft/scrollTop are plain, settable jsdom properties
  // already, so they need no stubbing) fixed, realistic measurements.
  Object.defineProperty(HTMLElement.prototype, "clientWidth", {
    configurable: true,
    get: () => 910,
  });
  Object.defineProperty(HTMLElement.prototype, "offsetLeft", {
    configurable: true,
    get: () => 320,
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
  for (const prop of ["clientWidth", "offsetLeft", "getBoundingClientRect"]) {
    delete (HTMLElement.prototype as unknown as Record<string, unknown>)[prop];
  }
});

describe("Gantt wheel-zoom", () => {
  it("widens the day columns when scrolling up (zoom in) over the timeline", () => {
    const { container } = show();
    const grid = container.querySelector<HTMLElement>(
      '[style*="grid-template-columns: repeat"]',
    );
    expect(grid).toBeTruthy();
    const before = grid?.style.gridTemplateColumns;

    fireEvent.wheel(grid as HTMLElement, {
      deltaY: -200,
      clientX: 500,
      clientY: 40,
    });

    expect(grid?.style.gridTemplateColumns).not.toBe(before);
    // 2.75rem * exp(200 * 0.0015) ≈ 3.71rem.
    expect(grid?.style.gridTemplateColumns).toMatch(/minmax\(3\.7/);
  });

  it("narrows the day columns when scrolling down (zoom out)", () => {
    const { container } = show();
    const grid = container.querySelector<HTMLElement>(
      '[style*="grid-template-columns: repeat"]',
    );

    fireEvent.wheel(grid as HTMLElement, {
      deltaY: 200,
      clientX: 500,
      clientY: 40,
    });

    // 2.75rem * exp(-200 * 0.0015) ≈ 2.04rem.
    expect(grid?.style.gridTemplateColumns).toMatch(/minmax\(2\.0/);
  });

  it("prevents the default scroll so the page doesn't also scroll while zooming", () => {
    const { container } = show();
    const grid = container.querySelector<HTMLElement>(
      '[style*="grid-template-columns: repeat"]',
    );
    const event = new WheelEvent("wheel", {
      deltaY: -100,
      clientX: 500,
      clientY: 40,
      bubbles: true,
      cancelable: true,
    });
    grid?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it("leaves the task rail's own vertical scroll alone (no zoom, no preventDefault)", () => {
    const { container } = show();
    const rail = container.querySelector("[data-gantt-rail]");
    expect(rail).toBeTruthy();
    const event = new WheelEvent("wheel", {
      deltaY: 100,
      bubbles: true,
      cancelable: true,
    });
    rail?.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
  });
});

describe("Gantt drag-to-pan", () => {
  it("scrolls the container left/right as a mouse drags across empty background", () => {
    const { container } = show();
    const scrollContainer = screen.getByTestId("gantt-scroll-container");
    scrollContainer.scrollLeft = 200;
    scrollContainer.scrollTop = 30;

    const background = container.querySelector(
      ".absolute.inset-y-0.z-0.grid",
    ) as HTMLElement;
    expect(background).toBeTruthy();

    fireEvent.pointerDown(background, {
      button: 0,
      pointerId: 1,
      pointerType: "mouse",
      clientX: 500,
      clientY: 100,
    });
    fireEvent.pointerMove(background, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 420,
      clientY: 70,
    });

    // Dragging left (clientX decreased by 80) pulls the content left, i.e.
    // increases scrollLeft by the same amount ("grab and pull").
    expect(scrollContainer.scrollLeft).toBe(280);
    expect(scrollContainer.scrollTop).toBe(60);

    fireEvent.pointerUp(background, { pointerId: 1, pointerType: "mouse" });

    // Once released, further movement shouldn't keep panning.
    fireEvent.pointerMove(background, {
      pointerId: 1,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    expect(scrollContainer.scrollLeft).toBe(280);
  });

  it("does not start a pan from a pointerdown on a task bar", () => {
    const { container } = show();
    const scrollContainer = screen.getByTestId("gantt-scroll-container");
    scrollContainer.scrollLeft = 200;

    const moveHandle = screen.getByRole("button", {
      name: "tasks:gantt.taskAriaLabel",
    });
    fireEvent.pointerDown(moveHandle, {
      button: 0,
      pointerId: 2,
      pointerType: "mouse",
      clientX: 500,
      clientY: 100,
    });
    fireEvent.pointerMove(container, {
      pointerId: 2,
      pointerType: "mouse",
      clientX: 300,
      clientY: 100,
    });

    // The bar's own drag-to-move takes over instead; the chart-level pan
    // handler never engaged, so scrollLeft is untouched.
    expect(scrollContainer.scrollLeft).toBe(200);
  });

  it("does not start a pan from a pointerdown on the task rail", () => {
    const { container } = show();
    const scrollContainer = screen.getByTestId("gantt-scroll-container");
    scrollContainer.scrollLeft = 200;

    const railButton = container.querySelector(
      "[data-gantt-rail] button",
    ) as HTMLElement;
    expect(railButton).toBeTruthy();
    fireEvent.pointerDown(railButton, {
      button: 0,
      pointerId: 3,
      pointerType: "mouse",
      clientX: 100,
      clientY: 100,
    });
    fireEvent.pointerMove(railButton, {
      pointerId: 3,
      pointerType: "mouse",
      clientX: 250,
      clientY: 100,
    });

    expect(scrollContainer.scrollLeft).toBe(200);
  });

  it("does not start a pan from a pointerdown on an external (cross-project) task bar", () => {
    relationsMock.data = [
      {
        id: "relation-1",
        sourceTaskId: "task-a",
        targetTaskId: "external-task",
        relationType: "blocks",
        sourceTask: { id: "task-a", projectId: "project" },
        targetTask: {
          id: "external-task",
          title: "Other project's task",
          number: 7,
          projectId: "other-project",
          projectName: "Other Project",
          projectSlug: "OTHER",
          status: "to-do",
          priority: null,
          userId: null,
          assigneeName: null,
          startDate: "2026-08-21",
          dueDate: "2026-08-22",
        },
      },
    ];
    const { container } = show();
    const scrollContainer = screen.getByTestId("gantt-scroll-container");
    scrollContainer.scrollLeft = 200;

    const externalBar = container.querySelector(
      "[data-gantt-external-bar]",
    ) as HTMLElement;
    expect(externalBar).toBeTruthy();
    fireEvent.pointerDown(externalBar, {
      button: 0,
      pointerId: 5,
      pointerType: "mouse",
      clientX: 500,
      clientY: 100,
    });
    fireEvent.pointerMove(externalBar, {
      pointerId: 5,
      pointerType: "mouse",
      clientX: 300,
      clientY: 100,
    });

    // The external bar is read-only (no drag of its own); a pointerdown on
    // it must still be excluded from pan-start, or dragging it just pans the
    // whole chart instead of doing nothing.
    expect(scrollContainer.scrollLeft).toBe(200);
  });

  it("ignores touch input, leaving native touch scrolling in charge", () => {
    const { container } = show();
    const scrollContainer = screen.getByTestId("gantt-scroll-container");
    scrollContainer.scrollLeft = 200;

    const background = container.querySelector(
      ".absolute.inset-y-0.z-0.grid",
    ) as HTMLElement;
    fireEvent.pointerDown(background, {
      button: 0,
      pointerId: 4,
      pointerType: "touch",
      clientX: 500,
      clientY: 100,
    });
    fireEvent.pointerMove(background, {
      pointerId: 4,
      pointerType: "touch",
      clientX: 300,
      clientY: 100,
    });

    expect(scrollContainer.scrollLeft).toBe(200);
  });
});
