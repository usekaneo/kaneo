import { describe, expect, it } from "vite-plus/test";
import { getAssignableRoleOptions } from "./get-assignable-role-options";

describe("getAssignableRoleOptions", () => {
  it("offers the workspace's assignable roles", () => {
    expect(
      getAssignableRoleOptions(["viewer", "member", "admin", "Designer"]),
    ).toEqual(["viewer", "member", "admin", "Designer"]);
  });

  it("falls back to the built-in roles until the list loads", () => {
    expect(getAssignableRoleOptions(undefined)).toEqual([
      "viewer",
      "member",
      "admin",
    ]);
  });

  it("keeps a member's current role selectable when it is not listed", () => {
    expect(getAssignableRoleOptions(undefined, "Designer")).toEqual([
      "viewer",
      "member",
      "admin",
      "Designer",
    ]);
    expect(getAssignableRoleOptions(["viewer"], "viewer")).toEqual(["viewer"]);
  });

  it("never offers the owner role", () => {
    expect(getAssignableRoleOptions(["viewer"], "owner")).toEqual(["viewer"]);
  });
});
