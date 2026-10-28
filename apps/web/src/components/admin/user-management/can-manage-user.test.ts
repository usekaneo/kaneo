import { describe, expect, it } from "vite-plus/test";
import { canManageUser } from "./can-manage-user";

const roles = [{ name: "auditor", permissions: ["audit:read" as const] }];

describe("canManageUser", () => {
  it("lets admins manage anyone", () => {
    expect(canManageUser("admin", roles, ["roles:manage"])).toBe(true);
  });

  it("keeps a custom role away from admins and wider roles", () => {
    expect(canManageUser("admin", roles, ["users:update"])).toBe(false);
    expect(canManageUser("user,auditor", roles, ["users:update"])).toBe(false);
    expect(
      canManageUser("auditor", roles, ["users:update", "audit:read"]),
    ).toBe(true);
    expect(canManageUser("user", roles, ["users:update"])).toBe(true);
  });
});
