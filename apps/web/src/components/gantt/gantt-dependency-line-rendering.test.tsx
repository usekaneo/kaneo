import { cleanup, render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// End-to-end proof for the "no dependency line is drawn at all" bug report:
// two same-project tasks, overlapping dates, a "blocks" relation between
// them, both rows measured (as they would be in a real browser) — this
// exercises the full data -> render path (the relations hook, the row/box
// measurement effects, buildDependencyEdges, and the SVG overlay) rather
// than only the pure geometry function.
const m = vi.hoisted(() => ({
  component: (() => null) as ComponentType,
  relations: [] as Record<string, unknown>[],
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
            {
              id: "task-b",
              projectId: "project",
              title: "Implement API",
              number: 2,
              status: "to-do",
              startDate: "2026-08-23",
              dueDate: "2026-08-29",
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
vi.mock("@/hooks/mutations/task/use-bulk-update-task-schedule", () => ({
  useBulkUpdateTaskSchedule: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task/use-update-task", () => ({
  useUpdateTask: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/mutations/task-relation/use-create-task-relation", () => ({
  default: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: () => ({ data: m.relations }),
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

function makeRelatedTask(overrides: Record<string, unknown>) {
  return {
    id: "task-a",
    title: "Design API",
    status: "to-do",
    priority: "low",
    number: 1,
    projectId: "project",
    projectName: "Project",
    projectSlug: "PROJ",
    userId: null,
    assigneeName: null,
    startDate: "2026-08-20",
    dueDate: "2026-08-25",
    ...overrides,
  };
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
  // jsdom does not lay out elements, so offsetTop/offsetHeight/offsetLeft and
  // clientWidth are always 0 — the same measurements the Gantt route reads
  // via refs + ResizeObserver in a real browser. Overriding them here
  // reproduces "both rows measured" instead of the always-empty-boxes state
  // jsdom would otherwise give every test, which would trivially (and
  // misleadingly) make dependency lines never render regardless of whether
  // the component logic is correct.
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
  m.relations = [];
});

function show() {
  const Component = m.component;
  return render(<Component />);
}

describe("Gantt dependency-line rendering", () => {
  it("draws a red connector between two same-project, overlapping, blocking tasks", () => {
    m.relations = [
      {
        id: "relation-1",
        sourceTaskId: "task-a",
        targetTaskId: "task-b",
        relationType: "blocks",
        createdAt: "2026-08-01T00:00:00.000Z",
        sourceTask: makeRelatedTask({ id: "task-a" }),
        targetTask: makeRelatedTask({
          id: "task-b",
          title: "Implement API",
          number: 2,
          startDate: "2026-08-23",
          dueDate: "2026-08-29",
        }),
      },
    ];

    const { container } = show();

    const paths = container.querySelectorAll("svg path[stroke]");
    expect(paths).toHaveLength(1);
    expect(paths[0]?.getAttribute("stroke")).toBe("var(--destructive)");
  });

  it("draws nothing when the relations query hasn't returned any relation", () => {
    m.relations = [];
    const { container } = show();
    expect(container.querySelectorAll("svg path[stroke]")).toHaveLength(0);
  });
});
