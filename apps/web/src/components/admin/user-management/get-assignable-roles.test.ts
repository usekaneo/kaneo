import { describe, expect, it } from "vite-plus/test";
import { getAssignableRoles } from "./get-assignable-roles";

const roles = [
  { name: "auditor", permissions: ["audit:read" as const] },
  { name: "reader", permissions: ["users:read" as const] },
];

describe("getAssignableRoles", () => {
  it("offers every role to an admin", () => {
    expect(getAssignableRoles(roles, ["roles:manage"], "user")).toEqual([
      "user",
      "admin",
      "auditor",
      "reader",
    ]);
  });

  it("offers a custom role only roles within its permissions", () => {
    expect(
      getAssignableRoles(roles, ["users:read", "users:update"], "user"),
    ).toEqual(["user", "reader"]);
  });

  it("keeps the current role visible", () => {
    expect(getAssignableRoles(roles, ["users:read"], "auditor")).toEqual([
      "user",
      "auditor",
      "reader",
    ]);
  });
});
