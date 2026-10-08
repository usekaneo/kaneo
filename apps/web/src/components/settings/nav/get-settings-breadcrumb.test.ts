import { describe, expect, it } from "vite-plus/test";
import { buildSettingsNav } from "@/components/settings/nav/build-settings-nav";
import { getSettingsBreadcrumb } from "@/components/settings/nav/get-settings-breadcrumb";

const nav = buildSettingsNav({
  t: (key) => key,
  workspaceName: "Acme",
  billingEnabled: false,
  hasAdminAccess: true,
  projects: [{ id: "p1", name: "Kaneo Web" }],
});

describe("getSettingsBreadcrumb", () => {
  it("names the group and page for account and workspace pages", () => {
    expect(
      getSettingsBreadcrumb(nav, "/dashboard/settings/account/preferences"),
    ).toEqual({
      section: "settings:account",
      page: "settings:preferences",
    });
    expect(
      getSettingsBreadcrumb(nav, "/dashboard/settings/workspace/labels/"),
    ).toEqual({ section: "Acme", page: "settings:workspaceLabels.title" });
  });

  it("uses the project name for project pages", () => {
    expect(
      getSettingsBreadcrumb(
        nav,
        "/dashboard/settings/projects/p1/integrations",
      ),
    ).toEqual({
      section: "Kaneo Web",
      page: "settings:projectIntegrations.title",
    });
  });

  it("returns null for paths outside the nav", () => {
    expect(getSettingsBreadcrumb(nav, "/dashboard/settings/projects")).toBe(
      null,
    );
  });
});
