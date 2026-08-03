import { beforeEach, describe, expect, it, vi } from "vitest";

const execute = vi.fn();
const select = vi.fn();
const update = vi.fn();
const insert = vi.fn();

vi.mock("../../../apps/api/src/database", async (importOriginal) => ({
  ...(await importOriginal()),
  default: { execute, insert, select, update },
}));

const { addMissingDefaultRoleResources, seedDefaultWorkspaceRoles } =
  await import("../../../apps/api/src/utils/seed-default-workspace-roles");

describe("addMissingDefaultRoleResources", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upgrades a persisted default role with missing resources without overwriting custom permissions", () => {
    const existingPermission = JSON.stringify({
      task: ["read"],
      custom_resource: ["delete"],
    });

    const upgraded = addMissingDefaultRoleResources(existingPermission, {
      item_type: ["read"],
      saved_view: ["create", "read", "update", "delete"],
    });

    expect(JSON.parse(upgraded ?? "{}")).toEqual({
      task: ["read"],
      custom_resource: ["delete"],
      item_type: ["read"],
      saved_view: ["create", "read", "update", "delete"],
    });
  });

  it("upgrades persisted default-role rows without overwriting customized resources", async () => {
    const existingPermission = JSON.stringify({ task: ["read"] });
    const selectFrom = vi
      .fn()
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([
          {
            id: "role-1",
            workspaceId: "workspace-1",
            role: "member",
            permission: existingPermission,
          },
        ]),
      });
    const set = vi
      .fn()
      .mockReturnValue({ where: vi.fn().mockResolvedValue({}) });
    const values = vi.fn().mockResolvedValue({});

    execute.mockResolvedValue({ rows: [{ exists: true }] });
    select.mockReturnValue({ from: selectFrom });
    update.mockReturnValue({ set });
    insert.mockReturnValue({ values });

    await seedDefaultWorkspaceRoles();

    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({
        permission: JSON.stringify({
          task: ["read"],
          item_type: ["read"],
          saved_view: ["create", "read", "update", "delete"],
        }),
      }),
    );
  });

  it("does not restore a resource a user removes after the one-time upgrade", async () => {
    const selectFrom = vi
      .fn()
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([
          {
            id: "role-1",
            workspaceId: "workspace-1",
            role: "member",
            permission: JSON.stringify({ task: ["read"] }),
            permissionUpgradeVersion: 0,
          },
        ]),
      })
      .mockResolvedValueOnce([{ id: "workspace-1" }])
      .mockReturnValueOnce({
        where: vi.fn().mockResolvedValue([
          {
            id: "role-1",
            workspaceId: "workspace-1",
            role: "member",
            permission: JSON.stringify({ task: ["read"] }),
            permissionUpgradeVersion: 1,
          },
        ]),
      });
    const set = vi
      .fn()
      .mockReturnValue({ where: vi.fn().mockResolvedValue({}) });

    execute.mockResolvedValue({ rows: [{ exists: true }] });
    select.mockReturnValue({ from: selectFrom });
    update.mockReturnValue({ set });
    insert.mockReturnValue({ values: vi.fn().mockResolvedValue({}) });

    await seedDefaultWorkspaceRoles();
    await seedDefaultWorkspaceRoles();

    expect(set).toHaveBeenCalledTimes(1);
    expect(set).toHaveBeenCalledWith(
      expect.objectContaining({ permissionUpgradeVersion: 1 }),
    );
  });
});
