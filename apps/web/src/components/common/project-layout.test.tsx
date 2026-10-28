import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
import type { ProjectPluginView } from "@/lib/plugins/runtime/use-project-plugin-views";
import ProjectLayout from "./project-layout";

const project = vi.hoisted(() => ({
  current: { data: undefined, error: null } as {
    data: { name: string } | undefined;
    error: unknown;
  },
}));

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => vi.fn(),
  useLocation: () => ({ pathname: "/board" }),
  useRouter: () => ({
    buildLocation: ({ to }: { to: string }) => ({ href: to }),
  }),
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));
const plugin = vi.hoisted(() => ({
  views: [] as ProjectPluginView[],
}));

vi.mock(
  "@/lib/plugins/runtime/use-project-plugin-views",
  async (importOriginal) => ({
    ...(await importOriginal<
      typeof import("@/lib/plugins/runtime/use-project-plugin-views")
    >()),
    useProjectPluginViews: () => plugin.views,
  }),
);
vi.mock("@/components/project/views/use-project-view-shortcuts", () => ({
  useProjectViewShortcuts: () => undefined,
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: () => project.current,
}));
vi.mock("@/hooks/use-project-websocket", () => ({
  useProjectWebSocket: () => undefined,
}));
vi.mock("@/components/common/layout", () => {
  const Layout = ({ children }: { children: ReactNode }) => <>{children}</>;
  Layout.Header = ({ children }: { children: ReactNode }) => <>{children}</>;
  Layout.Content = ({ children }: { children: ReactNode }) => (
    <main>{children}</main>
  );
  return { default: Layout };
});
vi.mock("@/components/ui/sidebar", () => ({ SidebarTrigger: () => null }));
vi.mock("@/components/common/header/mobile-project-nav", () => ({
  default: () => null,
}));
vi.mock("@/components/common/header/project-crumb-select", () => ({
  default: () => null,
}));
vi.mock("@/components/common/header/workspace-crumb-select", () => ({
  default: () => null,
}));
vi.mock("@/components/shared/modals/create-project-modal", () => ({
  default: () => null,
}));
vi.mock("@/components/page-title", () => ({ default: () => null }));

afterEach(() => {
  cleanup();
  plugin.views = [];
});

function renderLayout() {
  render(
    <ProjectLayout
      projectId="project-1"
      workspaceId="workspace-1"
      activeView="board"
      toolbar={<button type="button">Toolbar action</button>}
      summary={<span>5 tasks</span>}
    >
      <p>Board content</p>
    </ProjectLayout>,
  );
}

describe("ProjectLayout access states", () => {
  it("replaces the board with a no-access state on 403", () => {
    project.current = { data: undefined, error: new HttpError(403, "denied") };
    renderLayout();

    expect(
      screen.getByRole("heading", {
        name: "workspace:projects.unavailable.noAccessTitle",
      }),
    ).toBeVisible();
    expect(
      screen.getByRole("link", {
        name: "workspace:projects.unavailable.backToWorkspace",
      }),
    ).toBeVisible();
    expect(screen.queryByText("Board content")).toBeNull();
    expect(screen.queryByText("Toolbar action")).toBeNull();
  });

  it("shows a not-found state on 404", () => {
    project.current = { data: undefined, error: new HttpError(404, "gone") };
    renderLayout();

    expect(
      screen.getByRole("heading", {
        name: "workspace:projects.unavailable.notFoundTitle",
      }),
    ).toBeVisible();
  });

  it("renders the project when it loads", () => {
    project.current = { data: { name: "Alpha" }, error: null };
    renderLayout();

    expect(screen.getByText("Board content")).toBeVisible();
    expect(screen.getByText("Toolbar action")).toBeVisible();
    expect(screen.getByText("5 tasks")).toBeVisible();
  });

  it("marks tasks as current and links the backlog", () => {
    project.current = { data: { name: "Alpha" }, error: null };
    renderLayout();

    expect(
      screen
        .getByRole("link", { name: "tasks:title" })
        .getAttribute("aria-current"),
    ).toBe("page");
    const backlog = screen.getByRole("link", { name: "tasks:view.backlog" });
    expect(backlog.getAttribute("aria-current")).toBeNull();
    expect(backlog.getAttribute("href")).toBe(
      "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
    );
  });

  it("links plugin views and marks the open one instead of tasks", () => {
    project.current = { data: { name: "Alpha" }, error: null };
    plugin.views = [
      {
        pluginId: "gantt",
        viewId: "timeline",
        title: "Timeline",
        icon: undefined,
        shortcut: "g",
      },
    ];
    render(
      <ProjectLayout
        projectId="project-1"
        workspaceId="workspace-1"
        activePluginView={{ pluginId: "gantt", viewId: "timeline" }}
      >
        <p>Timeline content</p>
      </ProjectLayout>,
    );

    const timeline = screen.getByRole("link", { name: "Timeline" });
    expect(timeline.getAttribute("aria-current")).toBe("page");
    expect(timeline.getAttribute("href")).toBe(
      "/dashboard/workspace/$workspaceId/project/$projectId/plugin/$pluginId/$viewId",
    );
    expect(
      screen
        .getByRole("link", { name: "tasks:title" })
        .getAttribute("aria-current"),
    ).toBeNull();
  });
});
