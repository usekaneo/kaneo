import { cleanup, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { HttpError } from "@/lib/http-error";
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
  Link: ({ children, to }: { children: ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
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

afterEach(cleanup);

function renderLayout() {
  render(
    <ProjectLayout projectId="project-1" workspaceId="workspace-1">
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
  });
});
