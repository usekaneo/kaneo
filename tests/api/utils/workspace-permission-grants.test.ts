import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

const { state, select } = vi.hoisted(() => {
  const state = { rows: new Map<object, unknown[]>() };
  return {
    state,
    select: vi.fn(() => ({
      from: (table: object) => ({
        where: () => {
          const result = Promise.resolve(state.rows.get(table) ?? []);
          return Object.assign(result, { limit: () => result });
        },
      }),
    })),
  };
});
vi.mock("../../../apps/api/src/database", async () => ({
  default: { select },
  schema: await import("../../../apps/api/src/database/schema"),
}));

import * as schema from "../../../apps/api/src/database/schema";
import { workspacePermissionGrants } from "../../../apps/api/src/utils/workspace-permission-grants";

beforeEach(() => {
  state.rows.clear();
  select.mockClear();
  state.rows.set(schema.userTable, [{ role: "user" }]);
});

describe("batched workspace permission grants", () => {
  it("keeps identically named role grants separate without querying per check", async () => {
    state.rows.set(schema.workspaceUserTable, [
      { workspaceId: "readable", role: "limited" },
      { workspaceId: "hidden", role: "limited" },
      { workspaceId: "fallback", role: "viewer" },
      { workspaceId: "overridden", role: "viewer" },
      { workspaceId: "multiple", role: "limited, reader" },
    ]);
    state.rows.set(schema.workspaceRoleTable, [
      {
        workspaceId: "readable",
        role: "limited",
        permission: '{"task":["read"]}',
      },
      { workspaceId: "hidden", role: "limited", permission: "{}" },
      { workspaceId: "overridden", role: "viewer", permission: "{}" },
      { workspaceId: "multiple", role: "limited", permission: "{}" },
      {
        workspaceId: "multiple",
        role: "reader",
        permission: '{"task":["read"]}',
      },
    ]);
    const grants = await workspacePermissionGrants("user", {
      apiKeyPermissions: null,
    });
    for (let index = 0; index < 100; index++) {
      for (const workspace of ["readable", "fallback", "multiple"]) {
        expect(grants.allows(workspace, { task: ["read"] })).toBe(true);
      }
      for (const workspace of ["hidden", "overridden", "missing"]) {
        expect(grants.allows(workspace, { task: ["read"] })).toBe(false);
      }
    }
    expect(select).toHaveBeenCalledTimes(3);
  });

  it("applies key scope even to an instance administrator", async () => {
    state.rows.set(schema.userTable, [{ role: "admin" }]);
    const grants = await workspacePermissionGrants("user", {
      apiKeyPermissions: { label: ["read"] },
    });
    expect(grants.allows("any-workspace", { task: ["read"] })).toBe(false);
    expect(grants.allows("any-workspace", { label: ["read"] })).toBe(true);
    const emptyScope = await workspacePermissionGrants("user", {
      apiKeyPermissions: {},
    });
    expect(emptyScope.allows("any-workspace", { task: ["read"] })).toBe(false);
  });

  it("reloads role changes for the next request and denies a missing user", async () => {
    state.rows.set(schema.workspaceUserTable, [
      { workspaceId: "workspace", role: "limited" },
    ]);
    state.rows.set(schema.workspaceRoleTable, [
      {
        workspaceId: "workspace",
        role: "limited",
        permission: '{"task":["read"]}',
      },
    ]);
    expect(
      (await workspacePermissionGrants("user")).allows("workspace", {
        task: ["read"],
      }),
    ).toBe(true);
    state.rows.set(schema.workspaceRoleTable, [
      { workspaceId: "workspace", role: "limited", permission: "{}" },
    ]);
    expect(
      (await workspacePermissionGrants("user")).allows("workspace", {
        task: ["read"],
      }),
    ).toBe(false);
    state.rows.set(schema.userTable, []);
    expect(
      (await workspacePermissionGrants("user")).allows("workspace", {
        task: ["read"],
      }),
    ).toBe(false);
  });
});
