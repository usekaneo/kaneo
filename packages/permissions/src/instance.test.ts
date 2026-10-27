import { describe, expect, it } from "vite-plus/test";
import {
  CUSTOM_ROLE_PERMISSIONS,
  INSTANCE_ROLE_NAME_PATTERN,
  isCustomRolePermission,
  parseInstanceRoles,
} from "./instance";

describe("instance permissions", () => {
  it("keeps role management out of custom roles", () => {
    expect(CUSTOM_ROLE_PERMISSIONS).not.toContain("roles:manage");
    expect(isCustomRolePermission("roles:manage")).toBe(false);
    expect(isCustomRolePermission("users:read")).toBe(true);
  });

  it("parses comma-separated role lists", () => {
    expect(parseInstanceRoles("user,support,,admin")).toEqual([
      "user",
      "support",
      "admin",
    ]);
    expect(parseInstanceRoles("user, admin")).toEqual(["user", " admin"]);
    expect(parseInstanceRoles(null)).toEqual([]);
  });

  it.each(["support", "help-desk", "ops2"])("accepts the name %s", (name) => {
    expect(INSTANCE_ROLE_NAME_PATTERN.test(name)).toBe(true);
  });

  it.each(["a", "Support", "2ops", "help desk", "a,b", "-x"])(
    "rejects the name %s",
    (name) => {
      expect(INSTANCE_ROLE_NAME_PATTERN.test(name)).toBe(false);
    },
  );
});
