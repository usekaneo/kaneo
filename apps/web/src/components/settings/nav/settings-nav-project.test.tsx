import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { buildSettingsNav } from "@/components/settings/nav/build-settings-nav";
import { SettingsNavProject } from "@/components/settings/nav/settings-nav-project";
import { SidebarMenu, SidebarProvider } from "@/components/ui/sidebar";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children, ...props }: { to: string; children?: ReactNode }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("@/hooks/use-mobile", () => ({ useIsMobile: () => false }));

const [project] = buildSettingsNav({
  t: (key) => key,
  billingEnabled: false,
  hasAdminAccess: false,
  projects: [{ id: "p1", name: "Kaneo Web" }],
}).projects;

function renderProject(pathname: string) {
  return render(
    <SidebarProvider>
      <SidebarMenu>
        {project ? (
          <SettingsNavProject project={project} pathname={pathname} />
        ) : null}
      </SidebarMenu>
    </SidebarProvider>,
  );
}

afterEach(() => {
  cleanup();
});

describe("SettingsNavProject", () => {
  it("starts expanded on one of its own pages and marks that page", () => {
    renderProject("/dashboard/settings/projects/p1/integrations");

    expect(
      screen
        .getByRole("button", { name: "Kaneo Web" })
        .getAttribute("aria-expanded"),
    ).toBe("true");
    expect(
      screen
        .getByRole("link", { name: "settings:projectIntegrations.title" })
        .getAttribute("data-active"),
    ).toBe("true");
  });

  it("starts collapsed elsewhere and expands on click", () => {
    renderProject("/dashboard/settings/account/information");
    const toggle = screen.getByRole("button", { name: "Kaneo Web" });

    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(
      screen.getByRole("link", { name: "settings:projectGeneral.title" }),
    ).toBeTruthy();
  });
});
