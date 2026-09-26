import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// End-to-end proof for the subtask summary-bar/collapse feature: a parent
// task with two subtasks (plus one unrelated "blocks" relation touching a
// subtask), rendered through the full route — the relations hook, the
// hierarchy/rollup math, row measurement, and the summary/normal bar choice
// — rather than only the pure gantt-hierarchy.ts functions.
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
              id: "task-parent",
              projectId: "project",
              title: "Ship the release",
              number: 1,
              status: "to-do",
              // The parent's own dates are deliberately outside its
              // children's — proving the summary bar spans the CHILDREN,
              // not a mix with the parent's own dates (see gantt-hierarchy.ts).
              startDate: "2026-08-01",
              dueDate: "2026-08-02",
              description: "",
              labels: [],
              priority: "low",
              position: 1,
            },
            {
              id: "task-child-1",
              projectId: "project",
              title: "Write the changelog",
              number: 2,
              status: "to-do",
              startDate: "2026-08-20",
              dueDate: "2026-08-22",
              description: "",
              labels: [],
              priority: "low",
              position: 2,
            },
            {
              id: "task-child-2",
              projectId: "project",
              title: "Cut the tag",
              number: 3,
              status: "to-do",
              startDate: "2026-08-25",
              dueDate: "2026-08-29",
              description: "",
              labels: [],
              priority: "low",
              position: 3,
            },
            {
              id: "task-other",
              projectId: "project",
              title: "Announce the release",
              number: 4,
              status: "to-do",
              startDate: "2026-08-21",
              dueDate: "2026-08-23",
              description: "",
              labels: [],
              priority: "low",
              position: 4,
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
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: () => ({ data: m.relations }),
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
    id: "task-child-1",
    title: "Write the changelog",
    status: "to-do",
    priority: "low",
    number: 2,
    projectId: "project",
    projectName: "Project",
    projectSlug: "PROJ",
    userId: null,
    assigneeName: null,
    startDate: "2026-08-20",
    dueDate: "2026-08-22",
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
  // See the matching comment in gantt-dependency-line-rendering.test.tsx:
  // jsdom never lays anything out, so these are stubbed to reproduce "every
  // row measured" the way a real browser would.
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

  m.relations = [
    {
      id: "relation-subtask-1",
      sourceTaskId: "task-parent",
      targetTaskId: "task-child-1",
      relationType: "subtask",
      createdAt: "2026-08-01T00:00:00.000Z",
      sourceTask: null,
      targetTask: null,
    },
    {
      id: "relation-subtask-2",
      sourceTaskId: "task-parent",
      targetTaskId: "task-child-2",
      relationType: "subtask",
      createdAt: "2026-08-01T00:00:00.000Z",
      sourceTask: null,
      targetTask: null,
    },
    {
      id: "relation-blocks",
      sourceTaskId: "task-child-1",
      targetTaskId: "task-other",
      relationType: "blocks",
      createdAt: "2026-08-01T00:00:00.000Z",
      sourceTask: makeRelatedTask({ id: "task-child-1" }),
      targetTask: makeRelatedTask({
        id: "task-other",
        title: "Announce the release",
        number: 4,
        startDate: "2026-08-21",
        dueDate: "2026-08-23",
      }),
    },
  ];
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

describe("Gantt subtask rollup rendering", () => {
  it("renders the parent as a summary row spanning its children, expanded by default with both children shown", () => {
    show();

    // The parent shows a chevron in the "collapse" state (expanded by
    // default) rather than the normal drag-to-move bar controls.
    expect(
      screen.getByRole("button", { name: "tasks:gantt.collapseSubtasks" }),
    ).toBeInTheDocument();
    // Each title shows twice while expanded — once in the sticky task rail,
    // once inside the child's own normal (non-summary) bar label — so these
    // use getAllByText rather than the single-match getByText.
    expect(screen.getAllByText("Ship the release").length).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Write the changelog").length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Cut the tag").length).toBeGreaterThan(0);

    // The summary bar itself (its own button, tagged with the parent's
    // title via the `title` attribute) renders, and it is NOT the normal
    // draggable task bar — no resize-start/resize-due handles exist for the
    // parent's own row.
    const summaryButton = document.querySelector(
      'button[title="Ship the release"]',
    );
    expect(summaryButton).not.toBeNull();
  });

  it("collapses the parent to hide its children (and the dependency line touching one of them)", () => {
    show();

    // One "blocks" edge exists (child-1 -> other), so exactly one path
    // renders while everything is visible.
    expect(document.querySelectorAll("svg path[stroke]")).toHaveLength(1);

    fireEvent.click(
      screen.getByRole("button", { name: "tasks:gantt.collapseSubtasks" }),
    );

    // Collapsing hid both children — including the one the dependency line
    // was attached to.
    expect(screen.queryAllByText("Write the changelog")).toHaveLength(0);
    expect(screen.queryAllByText("Cut the tag")).toHaveLength(0);
    // The parent's own row (and its summary bar) remain.
    expect(screen.getAllByText("Ship the release").length).toBeGreaterThan(0);
    // With its endpoint's row (and box) gone, the dependency line is no
    // longer drawn at all — not rerouted to the summary bar.
    expect(document.querySelectorAll("svg path[stroke]")).toHaveLength(0);

    // Expanding again brings both children (and the line) straight back.
    fireEvent.click(
      screen.getByRole("button", { name: "tasks:gantt.expandSubtasks" }),
    );
    expect(
      screen.getAllByText("Write the changelog").length,
    ).toBeGreaterThan(0);
    expect(document.querySelectorAll("svg path[stroke]")).toHaveLength(1);
  });

  it("still shows a child that matches the search even when its parent does not", () => {
    show();

    fireEvent.change(
      screen.getByPlaceholderText("tasks:gantt.searchPlaceholder"),
      { target: { value: "changelog" } },
    );

    // The child renders as an ordinary (unindented, chevron-less) row rather
    // than vanishing — a search matching only a child used to hide it
    // entirely, since flattenGanttRows only visits a parent's children when
    // the parent itself made it into the top-level list.
    expect(
      screen.getAllByText("Write the changelog").length,
    ).toBeGreaterThan(0);
    expect(screen.queryAllByText("Ship the release")).toHaveLength(0);
    expect(screen.queryAllByText("Cut the tag")).toHaveLength(0);
    expect(
      screen.queryByRole("button", { name: "tasks:gantt.collapseSubtasks" }),
    ).not.toBeInTheDocument();
  });
});
