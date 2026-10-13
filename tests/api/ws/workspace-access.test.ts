import { beforeEach, expect, it, vi } from "vite-plus/test";
import { workspaceTable } from "../../../apps/api/src/database/schema";
import type { WSContext } from "hono/ws";
import {
  hasWorkspaceAccess,
  syncWorkspaceAccess,
} from "../../../apps/api/src/ws/workspace-access";
const m = vi.hoisted(() => ({
  user: vi.fn(),
  memberships: vi.fn(),
  workspaces: vi.fn(),
}));
vi.mock("../../../apps/api/src/database", () => ({
  default: {
    select: (fields: Record<string, unknown>) => ({
      from: (table: unknown) => ({
        where: () =>
          fields.role
            ? m.user()
            : table === workspaceTable
              ? m.workspaces()
              : m.memberships(),
      }),
    }),
  },
}));
beforeEach(() => {
  m.user.mockResolvedValue([{ role: "user" }]);
  m.workspaces.mockResolvedValue([{ workspaceId: "admin-accessible" }]);
  m.memberships.mockResolvedValue([{ workspaceId: "still-authorized" }]);
});
it("sends current workspace access when reconnecting after an offline removal", async () => {
  const ws = { send: vi.fn(), close: vi.fn() };
  await syncWorkspaceAccess("user", ws as unknown as WSContext);
  expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
    type: "WORKSPACE_ACCESS_SYNC",
    workspaceIds: ["still-authorized"],
  });
});
it("preserves instance-admin access independently of memberships", async () => {
  m.user.mockResolvedValue([{ role: "user,admin" }]);
  m.memberships.mockResolvedValue([]);
  const ws = { send: vi.fn(), close: vi.fn() };
  await syncWorkspaceAccess("user", ws as unknown as WSContext);
  expect(JSON.parse(ws.send.mock.calls[0][0])).toEqual({
    type: "WORKSPACE_ACCESS_SYNC",
    workspaceIds: ["admin-accessible"],
  });
});
it("requires a reconnect if access synchronization fails", async () => {
  m.memberships.mockRejectedValueOnce(new Error("database unavailable"));
  const ws = { send: vi.fn(), close: vi.fn() };
  await syncWorkspaceAccess("user", ws as unknown as WSContext);
  expect(ws.send).not.toHaveBeenCalled();
  expect(ws.close).toHaveBeenCalledWith(
    1011,
    "Workspace access synchronization failed",
  );
});

it("recognizes restored membership and administrator access for delayed revocations", async () => {
  expect(await hasWorkspaceAccess("user", "still-authorized")).toBe(true);
  m.memberships.mockResolvedValue([]);
  expect(await hasWorkspaceAccess("user", "removed")).toBe(false);
  m.user.mockResolvedValue([{ role: "user,admin" }]);
  expect(await hasWorkspaceAccess("user", "removed")).toBe(true);
  m.user.mockResolvedValue([]);
  expect(await hasWorkspaceAccess("user", "removed")).toBe(false);
});
