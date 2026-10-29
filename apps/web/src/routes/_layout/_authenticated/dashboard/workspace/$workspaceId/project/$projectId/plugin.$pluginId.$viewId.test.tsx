import {
  defineWeb,
  type ProjectViewProps,
  useProjectView,
} from "@kaneo/plugin-sdk/web";
import { cleanup, render, screen } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, beforeAll, expect, it, vi } from "vite-plus/test";
import { installPluginHost } from "@/lib/plugins/host/plugin-host";
import { loadedPluginsFixture } from "@/lib/plugins/runtime/loaded-plugins-fixture";
import { PluginsContext } from "@/lib/plugins/runtime/plugins-context";
import { Route } from "./plugin.$pluginId.$viewId";

const task = (id: string, dueDate: string | null) => ({
  id,
  projectId: "p",
  number: 1,
  title: id,
  description: null,
  status: "to-do",
  priority: null,
  assigneeId: null,
  assigneeName: null,
  startDate: null,
  dueDate,
});

const m = vi.hoisted(() => ({
  project: null as unknown,
  filteredProject: null as unknown,
  taskViewScope: vi.fn(),
}));

m.project = {
  id: "p",
  columns: [
    {
      tasks: [task("Launch", "2026-10-02T00:00:00.000Z"), task("Notes", null)],
    },
  ],
  plannedTasks: [task("Retro", "2026-10-09T00:00:00.000Z")],
  archivedTasks: [],
};
m.filteredProject = {
  id: "p",
  columns: [{ tasks: [task("Launch", "2026-10-02T00:00:00.000Z")] }],
  plannedTasks: [],
  archivedTasks: [],
};

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({
    ...(options as object),
    useParams: () => ({
      workspaceId: "w",
      projectId: "p",
      pluginId: "planner",
      viewId: "agenda",
    }),
    useSearch: () => ({}),
  }),
  useNavigate: () => vi.fn(),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: () => ({ data: { workspaceId: "w" }, isPending: false }),
}));
vi.mock("@/hooks/queries/task/use-get-tasks", () => ({
  useGetTasks: () => ({ data: m.project, isLoading: false, error: null }),
}));
vi.mock("@/components/project/toolbar/use-project-task-view", () => ({
  useProjectTaskView: ({ scope }: { scope: string }) => {
    m.taskViewScope(scope);
    return {
      subjects: [],
      filters: {
        filteredProject: m.filteredProject,
        clearFilters: vi.fn(),
        customFieldValues: {},
      },
    };
  },
}));
vi.mock("@/components/common/project-layout", () => ({
  default: ({
    toolbar,
    summary,
    children,
  }: {
    toolbar: ReactNode;
    summary: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      {toolbar}
      {summary}
      {children}
    </div>
  ),
}));
vi.mock("@/components/project/toolbar/project-toolbar", () => ({
  ProjectToolbar: ({ display }: { display: ReactNode }) => (
    <section aria-label="Display">{display}</section>
  ),
}));
vi.mock("@/components/project/views/layout-switch", () => ({
  LayoutSwitch: ({ currentView }: { currentView: string }) => (
    <p>{`Layout ${currentView}`}</p>
  ),
}));
vi.mock("@/components/project/toolbar/task-count", () => ({
  TaskCount: ({ shown, total }: { shown: number; total: number }) => (
    <p>{`${shown} of ${total} counted`}</p>
  ),
}));
vi.mock("@/components/project/task-filters/active-filters-bar", () => ({
  ActiveFiltersBar: () => null,
}));
vi.mock("@/components/task/task-details-sheet", () => ({
  default: () => null,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));

function Agenda(_props: ProjectViewProps) {
  const { tasks, allTasks } = useProjectView();
  return (
    <ul aria-label={`Agenda of ${allTasks.length}`}>
      {tasks.map((item) => (
        <li key={item.id}>{item.title}</li>
      ))}
    </ul>
  );
}

function AgendaDisplay(_props: ProjectViewProps) {
  const { tasks } = useProjectView();
  return <p>{`Display sees ${tasks.length}`}</p>;
}

const plugins = loadedPluginsFixture("w", [
  {
    id: "planner",
    definition: defineWeb({
      projectViews: [
        {
          id: "agenda",
          title: "Agenda",
          scope: "schedule",
          display: AgendaDisplay,
          countsTask: (item) => item.dueDate !== null,
          component: Agenda,
        },
      ],
    }),
  },
]);

beforeAll(() => {
  installPluginHost();
});

afterEach(() => {
  cleanup();
  m.taskViewScope.mockClear();
});

it("hands the plugin layout the host's filtered tasks for its scope", async () => {
  const Component = (Route as unknown as { component: ComponentType })
    .component;
  render(
    <PluginsContext.Provider
      value={{ workspaceId: "w", plugins, isPending: false }}
    >
      <Component />
    </PluginsContext.Provider>,
  );

  expect(m.taskViewScope).toHaveBeenCalledWith("schedule");
  const agenda = await screen.findByRole("list", { name: "Agenda of 3" });
  expect(agenda.textContent).toBe("Launch");
  expect(screen.getByText("Display sees 1")).toBeInTheDocument();
  expect(screen.getByText("Layout plugin:planner:agenda")).toBeInTheDocument();
  expect(screen.getByText("1 of 2 counted")).toBeInTheDocument();
});
