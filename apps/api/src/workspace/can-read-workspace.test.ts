import { describe, expect, it } from "vite-plus/test";
import { canReadWorkspace } from "./can-read-workspace";

const noRead = JSON.stringify({ task: ["read"] });

describe("canReadWorkspace", () => {
  it("allows built-in roles", () => {
    for (const role of ["viewer", "member", "admin", "owner"]) {
      expect(
        canReadWorkspace({ role, rolePermission: null, instanceAdmin: false }),
      ).toBe(true);
    }
  });

  it("denies a role whose permission lacks workspace:read", () => {
    expect(
      canReadWorkspace({
        role: "custom",
        rolePermission: noRead,
        instanceAdmin: false,
      }),
    ).toBe(false);
  });

  it("denies a non-member who is not an instance admin", () => {
    expect(
      canReadWorkspace({
        role: null,
        rolePermission: null,
        instanceAdmin: false,
      }),
    ).toBe(false);
  });

  it("lets instance admins read regardless of their role", () => {
    expect(
      canReadWorkspace({
        role: "custom",
        rolePermission: noRead,
        instanceAdmin: true,
      }),
    ).toBe(true);
    expect(
      canReadWorkspace({
        role: null,
        rolePermission: null,
        instanceAdmin: true,
      }),
    ).toBe(true);
  });
});
