import { describe, expect, it } from "vite-plus/test";
import { INSTANCE_PERMISSIONS } from "@kaneo/permissions";
import { getAdminPageRedirect } from "./admin-page-access";

const root = "/dashboard/settings/admin";

describe("admin page redirects", () => {
  it("lands full admins on Overview and support on Users", () => {
    expect(getAdminPageRedirect(root, INSTANCE_PERMISSIONS)).toBe(
      `${root}/overview`,
    );
    expect(getAdminPageRedirect(`${root}/`, ["users:read"])).toBe(
      `${root}/users`,
    );
  });

  it.each([
    "overview",
    "workspaces",
    "roles",
    "audit-log",
    "system",
    "settings",
  ])("redirects a support role away from %s", (page) => {
    expect(getAdminPageRedirect(`${root}/${page}`, ["users:read"])).toBe(
      `${root}/users`,
    );
  });

  it("keeps allowed pages and sends accounts without a page to account settings", () => {
    expect(getAdminPageRedirect(`${root}/users`, ["users:read"])).toBeNull();
    expect(
      getAdminPageRedirect(`${root}/overview`, INSTANCE_PERMISSIONS),
    ).toBeNull();
    expect(getAdminPageRedirect(`${root}/users`, ["system:read"])).toBe(
      `${root}/system`,
    );
    expect(getAdminPageRedirect(root, ["instance:settings"])).toBe(
      `${root}/settings`,
    );
    for (const permissions of [[], ["users:create"]] as const) {
      expect(getAdminPageRedirect(root, permissions)).toBe(
        "/dashboard/settings/account/information",
      );
    }
  });
});
