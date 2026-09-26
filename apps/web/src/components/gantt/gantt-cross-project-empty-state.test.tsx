import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression coverage: a project with zero scheduled tasks of its own must
// still render its cross-project (externally related) rows, rather than
// falling back to the "no tasks" empty state — see buildGanttRange's
// extraBoundsTasks fallback and the Gantt route's empty-state conditions.
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
// This project has NO tasks of its own at all.
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => ({
    data: {
      id: "project",
      name: "Project",
      slug: "PROJ",
      columns: [{ tasks: [] }],
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
// But it has a "related" relation to a task that lives in another project,
// with its own dates — the only reason this project's Gantt has anything to
// show at all.
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: () => ({
    data: [
      {
        id: "relation-1",
        sourceTaskId: "own-task-that-doesnt-exist-here",
        targetTaskId: "task-external",
        relationType: "related",
        createdAt: "2026-08-01T00:00:00.000Z",
        sourceTask: null,
        targetTask: {
          id: "task-external",
          title: "External work",
          status: "to-do",
          priority: "low",
          number: 7,
          projectId: "other-project",
          projectName: "Other Project",
          projectSlug: "OTHER",
          userId: null,
          assigneeName: null,
          startDate: "2026-08-20",
          dueDate: "2026-08-25",
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

describe("Gantt chart with no own tasks but a cross-project related row", () => {
  it("renders the external row instead of the empty state", () => {
    show();

    expect(screen.queryByText("tasks:gantt.noTasks")).not.toBeInTheDocument();
    expect(
      screen.getByText(
        'tasks:gantt.externalProjectBadge:{"projectName":"Other Project"}',
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("External work").length).toBeGreaterThan(0);
  });
});
