import { cleanup, render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import PageTitle from "@/components/page-title";
import { Route as DashboardRoute } from "../dashboard";
import { Route as SettingsRoute } from "./settings";

const location = vi.hoisted(() => ({
  pathname: "",
  workspaceName: undefined as string | undefined,
}));

vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useLocation: ({
    select,
  }: {
    select: (value: { pathname: string }) => string;
  }) => select(location),
  Outlet: () =>
    ["/dashboard", "/dashboard/settings"].includes(
      location.pathname.replace(/\/+$/, ""),
    ) ? null : (
      <PageTitle title="Preferences" />
    ),
}));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock("@/hooks/queries/workspace/use-active-workspace", () => ({
  default: () => ({ data: { name: location.workspaceName } }),
}));
vi.mock("@/hooks/use-pending-checkout", () => ({
  usePendingCheckout: () => undefined,
}));
vi.mock("@/components/settings/settings-shell", () => ({
  SettingsShell: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

afterEach(() => {
  cleanup();
  document.title = "";
});

describe("layout browser titles", () => {
  it.each([
    ["Dashboard", DashboardRoute, "/dashboard/settings/account/preferences"],
    ["Settings", SettingsRoute, "/dashboard/settings/account/preferences"],
    [
      "Dashboard",
      DashboardRoute,
      "/dashboard/workspace/workspace/project/project/board",
    ],
  ])("%s does not overwrite a nested page title", (_name, route, pathname) => {
    location.pathname = pathname;
    location.workspaceName = "Workspace";
    const Component = route.options.component as ComponentType;
    render(<Component />);
    expect(document.title).toBe("Preferences · Kaneo");
  });

  it.each([
    ["/dashboard/", DashboardRoute, "navigation:page.projectsTitle"],
    ["/dashboard/settings/", SettingsRoute, "navigation:page.settingsTitle"],
  ])("keeps the default title at %s", (pathname, route, title) => {
    location.pathname = pathname;
    location.workspaceName = "Workspace";
    const Component = route.options.component as ComponentType;
    render(<Component />);
    expect(document.title).toBe(`${title} · Kaneo`);
  });

  it("does not overwrite the nested title when workspace data finishes loading", () => {
    location.pathname = "/dashboard/settings/account/preferences";
    location.workspaceName = undefined;
    const Component = DashboardRoute.options.component as ComponentType;
    const view = render(<Component />);
    location.workspaceName = "Workspace";
    view.rerender(<Component />);
    expect(document.title).toBe("Preferences · Kaneo");
  });
});
