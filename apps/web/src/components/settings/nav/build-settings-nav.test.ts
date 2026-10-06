import { describe, expect, it } from "vite-plus/test";
import { buildSettingsNav } from "@/components/settings/nav/build-settings-nav";

const t = (key: string) => key;

function build(
  overrides: Partial<Parameters<typeof buildSettingsNav>[0]> = {},
) {
  return buildSettingsNav({
    t,
    workspaceName: "Acme",
    billingEnabled: false,
    hasAdminAccess: false,
    projects: [],
    ...overrides,
  });
}

describe("buildSettingsNav", () => {
  it("labels the workspace group with the workspace name", () => {
    expect(build().workspace.label).toBe("Acme");
    expect(build({ workspaceName: undefined }).workspace.label).toBe(
      "navigation:page.settingsWorkspaceTab",
    );
  });

  it("only offers billing when billing is enabled", () => {
    const linkIds = (nav: ReturnType<typeof build>) =>
      nav.workspace.links.map((link) => link.id);

    expect(linkIds(build())).not.toContain("workspace-billing");
    expect(linkIds(build({ billingEnabled: true }))).toContain(
      "workspace-billing",
    );
  });

  it("only shows administration to instance admins", () => {
    expect(build().admin).toBeNull();
    expect(build({ hasAdminAccess: true }).admin?.links[0]?.to).toBe(
      "/dashboard/settings/admin/users",
    );
  });

  it("gives every project its own settings pages", () => {
    const nav = build({
      projects: [{ id: "p1", name: "Kaneo Web", icon: "Unknown" }],
    });

    expect(nav.projects).toHaveLength(1);
    expect(nav.projects[0]?.links.map((link) => link.to)).toEqual([
      "/dashboard/settings/projects/p1/general",
      "/dashboard/settings/projects/p1/workflow",
      "/dashboard/settings/projects/p1/visibility",
      "/dashboard/settings/projects/p1/integrations",
      "/dashboard/settings/projects/p1/calendar",
    ]);
    expect(nav.projects[0]?.icon).toBeDefined();
  });
});
