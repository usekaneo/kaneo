import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ResolvedSavedView } from "@/types/saved-view";
import ProjectLayout from "./project-layout";
import ProjectViewSwitcher from "./project-view-switcher";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  useGetResolvedViews: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({ pathname: "/dashboard/project/project-1/board" }),
  useNavigate: () => mocks.navigate,
}));

vi.mock("@/components/common/header/mobile-project-nav", () => ({
  default: () => null,
}));

vi.mock("@/components/common/header/project-crumb-select", () => ({
  default: () => null,
}));

vi.mock("@/components/common/header/workspace-crumb-select", () => ({
  default: () => null,
}));

vi.mock("@/components/common/layout", () => {
  const Layout = Object.assign(
    ({ children }: { children: ReactNode }) => <>{children}</>,
    {
      Header: ({ children }: { children: ReactNode }) => <>{children}</>,
      Content: ({ children }: { children: ReactNode }) => <>{children}</>,
    },
  );

  return { default: Layout };
});

vi.mock("@/components/shared/modals/create-project-modal", () => ({
  default: () => null,
}));

vi.mock("@/components/ui/kbd", () => ({
  KbdSequence: () => null,
}));

vi.mock("@/components/ui/sidebar", () => ({
  SidebarTrigger: () => <button type="button">Toggle sidebar</button>,
}));

vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/hooks/queries/project/use-get-project", () => ({
  default: () => ({ data: { name: "Project" } }),
}));

vi.mock("@/hooks/queries/saved-view/use-get-resolved-views", () => ({
  default: (parameters: { workspaceId: string; projectId: string }) =>
    mocks.useGetResolvedViews(parameters),
}));

vi.mock("@/hooks/use-project-websocket", () => ({
  useProjectWebSocket: vi.fn(),
}));

const views: ResolvedSavedView[] = [
  {
    key: "backlog",
    name: "Backlog",
    type: "list",
    position: 0,
    enabled: true,
    configuration: {},
  },
  {
    key: "tasks",
    name: "Tasks",
    type: "board",
    position: 1,
    enabled: true,
    configuration: {},
  },
  {
    key: "gantt",
    name: "Gantt",
    type: "gantt",
    position: 2,
    enabled: true,
    configuration: {},
  },
];

afterEach(cleanup);

describe("ProjectViewSwitcher", () => {
  it("preserves the compact Kaneo view switcher", () => {
    render(
      <ProjectViewSwitcher
        activeView="board"
        views={views}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.getAllByRole("button")).toHaveLength(3);
    expect(screen.getByRole("button", { name: "Tasks" })).toHaveAttribute(
      "data-active",
      "true",
    );
  });

  it("hides disabled views", () => {
    render(
      <ProjectViewSwitcher
        activeView="board"
        views={[{ ...views[2], enabled: false }]}
        onSelect={vi.fn()}
      />,
    );

    expect(screen.queryByRole("button", { name: "Gantt" })).toBeNull();
  });

  it("maps list selection to the existing backlog view", () => {
    const onSelect = vi.fn();
    render(
      <ProjectViewSwitcher
        activeView="backlog"
        views={views}
        onSelect={onSelect}
      />,
    );

    const backlogButton = screen.getByRole("button", { name: "Backlog" });
    expect(backlogButton).toHaveAttribute("data-active", "true");
    fireEvent.click(backlogButton);
    expect(onSelect).toHaveBeenCalledWith("list");
  });
});

describe("ProjectLayout view integration", () => {
  it("uses configured labels and maps list selection to the existing backlog URL", () => {
    mocks.useGetResolvedViews.mockReturnValue({
      data: [{ ...views[0], name: "Planning" }],
      isError: false,
      isLoading: false,
    });

    render(
      <ProjectLayout projectId="project-1" workspaceId="workspace-1">
        Project content
      </ProjectLayout>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Planning" }));
    expect(mocks.useGetResolvedViews).toHaveBeenCalledWith({
      workspaceId: "workspace-1",
      projectId: "project-1",
    });
    expect(mocks.navigate).toHaveBeenCalledWith({
      to: "/dashboard/workspace/$workspaceId/project/$projectId/backlog",
      params: { workspaceId: "workspace-1", projectId: "project-1" },
    });
  });

  it.each([
    { data: undefined, isError: false, isLoading: true },
    { data: undefined, isError: true, isLoading: false },
    { data: [], isError: false, isLoading: false },
  ])("renders default views for an unavailable resolved query", (query) => {
    mocks.useGetResolvedViews.mockReturnValue(query);

    render(
      <ProjectLayout projectId="project-1" workspaceId="workspace-1">
        Project content
      </ProjectLayout>,
    );

    expect(screen.getByRole("button", { name: "Backlog" })).toBeVisible();
    expect(screen.getByRole("button", { name: "Tasks" })).toHaveAttribute(
      "data-active",
      "true",
    );
    expect(screen.getByRole("button", { name: "Gantt" })).toBeVisible();
  });
});
