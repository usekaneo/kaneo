import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import type { CalendarTask } from "@/components/calendar/calendar-task-bar";
import { Route } from "./calendar";

const state = vi.hoisted(() => ({
  mobile: false,
  projectError: false,
  relationsError: true,
  relations: undefined as
    | { sourceTaskId: string; targetTaskId: string; relationType: string }[]
    | undefined,
  project: {
    id: "p",
    slug: "PROJ",
    name: "Project",
    columns: [
      {
        tasks: [
          {
            id: "parent",
            title: "Parent",
            startDate: "2026-08-10",
            dueDate: "2026-08-12",
          },
          {
            id: "child",
            title: "Child",
            startDate: "2026-08-20",
            dueDate: "2026-08-21",
          },
        ],
      },
    ],
    plannedTasks: [],
    archivedTasks: [],
  },
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: object) => ({
    ...options,
    useParams: () => ({ projectId: "p", workspaceId: "w" }),
    useSearch: () => ({}),
  }),
  useNavigate: () => vi.fn(),
}));
vi.mock("react-i18next", async (importOriginal) => ({
  ...(await importOriginal<typeof import("react-i18next")>()),
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => ({
    data: state.project,
    isLoading: false,
    isError: state.projectError,
  }),
}));
vi.mock("@/hooks/queries/task-relation/use-get-project-task-relations", () => ({
  default: () => ({
    data: state.relations,
    isLoading: false,
    isError: state.relationsError,
  }),
}));
vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => state.mobile }));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (
    selector: (value: { weekStartsOn: number }) => unknown,
  ) => selector({ weekStartsOn: 1 }),
}));
vi.mock("@/components/project/toolbar/use-project-task-view", () => ({
  useProjectTaskView: () => ({
    filters: { filteredProject: state.project, clearFilters: vi.fn() },
    subjects: [],
  }),
}));
vi.mock("@/components/common/project-layout", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock("@/components/project/toolbar/project-toolbar", () => ({
  ProjectToolbar: () => null,
}));
vi.mock("@/components/project/display/week-start-control", () => ({
  WeekStartControl: () => null,
}));
vi.mock("@/components/project/views/layout-switch", () => ({
  LayoutSwitch: () => null,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));
vi.mock("@/components/calendar/calendar-toolbar", () => ({
  default: () => null,
}));
vi.mock("@/components/project/task-filters/active-filters-bar", () => ({
  ActiveFiltersBar: () => null,
}));
vi.mock("@/components/calendar/month-grid", () => ({
  default: ({ tasks }: { tasks: CalendarTask[] }) => (
    <div aria-label="Grid">
      {tasks.map((task) => (
        <p key={task.id}>
          {task.id}:{task.subtasks?.length ?? 0}
        </p>
      ))}
    </div>
  ),
}));
vi.mock("@/components/calendar/month-agenda", () => ({
  default: ({ tasks }: { tasks: CalendarTask[] }) => (
    <div aria-label="Agenda">
      {tasks.map((task) => (
        <p key={task.id}>
          {task.id}:{task.subtasks?.length ?? 0}
        </p>
      ))}
    </div>
  ),
}));
const Component = (Route as unknown as { component: ComponentType }).component;
afterEach(() => {
  cleanup();
  state.mobile = false;
  state.projectError = false;
  state.relationsError = true;
  state.relations = undefined;
});

it.each([false, true])(
  "keeps the calendar readable without relations (mobile=%s)",
  (mobile) => {
    state.mobile = mobile;
    render(<Component />);
    expect(screen.getByLabelText(mobile ? "Agenda" : "Grid")).toBeVisible();
    expect(screen.getByText("parent:0")).toBeVisible();
    expect(screen.getByText("child:0")).toBeVisible();
    expect(screen.queryByText("tasks:calendar.loadError")).toBeNull();
  },
);

it("discards stale edges after a failed refresh and groups again when the query recovers", () => {
  state.relations = [
    { sourceTaskId: "parent", targetTaskId: "child", relationType: "subtask" },
  ];
  const { rerender } = render(<Component />);
  expect(screen.getByText("child:0")).toBeVisible();
  state.relationsError = false;
  rerender(<Component />);
  expect(screen.getByText("parent:1")).toBeVisible();
  expect(screen.queryByText("child:0")).toBeNull();
});

it("still blocks the calendar when task loading fails", () => {
  state.projectError = true;
  render(<Component />);
  expect(screen.getByText("tasks:calendar.loadError")).toBeVisible();
  expect(screen.queryByLabelText("Grid")).toBeNull();
});
