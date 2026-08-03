import { describe, expect, it } from "vitest";
import {
  createDefaultWorkspaceRoleInsert,
  DEFAULT_ROLE_PERMISSION_UPGRADE_VERSION,
} from "../../../apps/api/src/utils/default-workspace-role";

describe("createDefaultWorkspaceRoleInsert", () => {
  it("creates new default roles at the current permission upgrade version", () => {
    const now = new Date("2026-08-03T12:00:00.000Z");

    const row = createDefaultWorkspaceRoleInsert("workspace-1", "member", now);

    expect(row).toEqual({
      workspaceId: "workspace-1",
      role: "member",
      permission: expect.any(String),
      permissionUpgradeVersion: DEFAULT_ROLE_PERMISSION_UPGRADE_VERSION,
      createdAt: now,
      updatedAt: now,
    });
    expect(JSON.parse(row.permission)).toEqual(
      expect.objectContaining({
        item_type: ["read"],
        saved_view: ["read"],
      }),
    );
  });
});
