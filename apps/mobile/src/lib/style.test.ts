import { describe, expect, it } from "vite-plus/test";
import { canManageWorkspace, hasRole } from "./style";

describe("hasRole", () => {
  it("finds a role among comma-separated roles", () => {
    expect(hasRole("admin,viewer", "admin")).toBe(true);
    expect(hasRole("member", "owner")).toBe(false);
    expect(hasRole(null, "owner")).toBe(false);
  });
});

describe("canManageWorkspace", () => {
  it("allows owners and admins, even alongside other roles", () => {
    expect(canManageWorkspace("viewer,admin")).toBe(true);
    expect(canManageWorkspace("owner")).toBe(true);
    expect(canManageWorkspace("member,viewer")).toBe(false);
  });
});
