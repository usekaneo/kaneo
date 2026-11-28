import { defineWeb } from "@kaneo/plugin-sdk/web";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vite-plus/test";
import { loadedPluginsFixture } from "@/lib/plugins/runtime/loaded-plugins-fixture";
import { PluginsContext } from "@/lib/plugins/runtime/plugins-context";
import type { RuntimePlugin } from "@/lib/plugins/runtime/select-contributions";
import { LayoutSwitch } from "./layout-switch";
import type { ProjectRoute, ProjectView } from "./project-views";

const m = vi.hoisted(() => ({
  navigate: vi.fn(),
  setViewMode: vi.fn(),
  setTaskLayout: vi.fn(),
  projectWorkspaceId: "w",
}));

vi.mock("@tanstack/react-router", () => ({ useNavigate: () => m.navigate }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/store/user-preferences", () => ({
  useUserPreferencesStore: (selector: (state: typeof m) => unknown) =>
    selector(m),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: () => ({ data: { workspaceId: m.projectWorkspaceId } }),
}));

const View = () => null;

const plugins = loadedPluginsFixture("w", [
  {
    id: "gantt",
    definition: defineWeb({
      projectViews: [{ id: "timeline", title: "Timeline", component: View }],
    }),
  },
  {
    id: "off",
    enabled: false,
    definition: defineWeb({
      projectViews: [{ id: "chart", title: "Chart", component: View }],
    }),
  },
]);

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  m.projectWorkspaceId = "w";
});

function renderSwitch(
  current: { route: ProjectRoute; view: ProjectView } = {
    route: "board",
    view: "board",
  },
  runtime: RuntimePlugin[] = [],
) {
  render(
    <PluginsContext.Provider
      value={{ workspaceId: "w", plugins: runtime, isPending: false }}
    >
      <LayoutSwitch
        workspaceId="w"
        projectId="p"
        currentRoute={current.route}
        currentView={current.view}
      />
    </PluginsContext.Provider>,
  );
}

it("marks the current layout as pressed", () => {
  renderSwitch();
  expect(
    screen.getByRole("button", { name: "tasks:view.board" }),
  ).toHaveAttribute("aria-pressed", "true");
  expect(
    screen.getByRole("button", { name: "tasks:calendar.title" }),
  ).toHaveAttribute("aria-pressed", "false");
  expect(screen.getAllByRole("button")).toHaveLength(3);
});

it("switches to list in place and navigates to other layouts", () => {
  renderSwitch();

  fireEvent.click(screen.getByRole("button", { name: "tasks:view.list" }));
  expect(m.setViewMode).toHaveBeenCalledWith("list");
  expect(m.navigate).not.toHaveBeenCalled();

  fireEvent.click(screen.getByRole("button", { name: "tasks:calendar.title" }));
  expect(m.setTaskLayout).toHaveBeenCalledWith("calendar");
  expect(m.navigate).toHaveBeenCalledWith({
    to: "/dashboard/workspace/$workspaceId/project/$projectId/calendar",
    params: { workspaceId: "w", projectId: "p" },
  });
});

it("lists layouts from plugins enabled in the project's workspace", () => {
  renderSwitch(undefined, plugins);

  const group = screen.getByRole("group", { name: "tasks:display.layout" });
  expect(group.style.gridTemplateColumns).toBe("repeat(4, minmax(0, 1fr))");
  expect(
    screen.getAllByRole("button").map((button) => button.textContent),
  ).toEqual([
    "tasks:view.board",
    "tasks:view.list",
    "tasks:calendar.title",
    "Timeline",
  ]);

  fireEvent.click(screen.getByRole("button", { name: "Timeline" }));
  expect(m.setTaskLayout).toHaveBeenCalledWith("plugin:gantt:timeline");
  expect(m.navigate).toHaveBeenCalledWith({
    to: "/dashboard/workspace/$workspaceId/project/$projectId/plugin/$pluginId/$viewId",
    params: {
      workspaceId: "w",
      projectId: "p",
      pluginId: "gantt",
      viewId: "timeline",
    },
  });
});

it("marks the open plugin layout and stays put when it is chosen again", () => {
  const gantt = "plugin:gantt:timeline" as const;
  renderSwitch({ route: gantt, view: gantt }, plugins);

  const timeline = screen.getByRole("button", { name: "Timeline" });
  expect(timeline).toHaveAttribute("aria-pressed", "true");
  fireEvent.click(timeline);
  expect(m.navigate).not.toHaveBeenCalled();
});

it("hides plugin layouts for a project from another workspace", () => {
  m.projectWorkspaceId = "other";
  renderSwitch(undefined, plugins);

  expect(screen.queryByRole("button", { name: "Timeline" })).toBeNull();
});
