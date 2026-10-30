import { and, eq } from "drizzle-orm";
import type { WSContext } from "hono/ws";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  addConnection,
  addUserConnection,
  removeConnection,
  removeUserConnection,
} from "../../apps/api/src/ws";
import { syncWorkspaceAccess } from "../../apps/api/src/ws/workspace-access";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
beforeEach(resetTestDatabase);
it("evicts a deleted workspace for an implicit administrator and reconciles offline administrators", async () => {
  const admin = await createWorkspaceMember();
  await db
    .update(schema.userTable)
    .set({ role: "user,admin" })
    .where(eq(schema.userTable.id, admin.user.id));
  const { app } = createApp();
  const signup = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      email: "delete-workspace-owner@example.test",
      password: "correct horse battery staple",
      name: "Owner",
    }),
  });
  expect(signup.status).toBe(200);
  const cookie = signup.headers
    .getSetCookie()
    .map((entry) => entry.split(";")[0])
    .join("; ");
  const created = await app.request("/api/auth/organization/create", {
    method: "POST",
    headers: { "content-type": "application/json", cookie },
    body: JSON.stringify({
      name: "Deleted workspace",
      slug: "deleted-workspace",
    }),
  });
  expect(created.status).toBe(200);
  const workspace = (await created.json()) as { id: string };
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  expect(
    await db.query.workspaceUserTable.findFirst({
      where: and(
        eq(schema.workspaceUserTable.workspaceId, workspace.id),
        eq(schema.workspaceUserTable.userId, admin.user.id),
      ),
    }),
  ).toBeUndefined();
  const global = { send: vi.fn(), close: vi.fn() };
  const board = { send: vi.fn(), close: vi.fn() };
  const userConnection = addUserConnection(
    admin.user.id,
    global as unknown as WSContext,
  );
  const projectConnection = addConnection(
    project.id,
    board as unknown as WSContext,
    admin.user.id,
    "window",
    workspace.id,
  );
  try {
    const deleted = await app.request("/api/auth/organization/delete", {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      body: JSON.stringify({ organizationId: workspace.id }),
    });
    expect(deleted.status).toBe(200);
    expect(board.close).toHaveBeenCalledWith(1008, "Workspace access revoked");
    expect(
      global.send.mock.calls.map(([message]) => JSON.parse(message)),
    ).toContainEqual({
      type: "WORKSPACE_ACCESS_REVOKED",
      workspaceId: workspace.id,
    });
    const reconnected = { send: vi.fn(), close: vi.fn() };
    await syncWorkspaceAccess(
      admin.user.id,
      reconnected as unknown as WSContext,
    );
    const snapshot = JSON.parse(reconnected.send.mock.calls[0][0]);
    expect(snapshot.workspaceIds).toContain(admin.workspace.id);
    expect(snapshot.workspaceIds).not.toContain(workspace.id);
  } finally {
    removeConnection(project.id, projectConnection);
    removeUserConnection(admin.user.id, userConnection);
  }
});
