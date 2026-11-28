import type { WSContext } from "hono/ws";
import { expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import {
  addUserConnection,
  initializeWebSocketAdapter,
  removeUserConnection,
  shutdownWebSocketAdapter,
} from "../../apps/api/src/ws";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

it("refreshes authorized workspace tabs after archive and restore", async () => {
  await resetTestDatabase();
  vi.stubEnv("REDIS_URL", "");
  await initializeWebSocketAdapter();
  const disconnect: Array<() => void> = [];
  function connectUser(userId: string) {
    const send = vi.fn();
    const conn = addUserConnection(userId, { send } as unknown as WSContext);
    disconnect.push(() => removeUserConnection(userId, conn));
    return send;
  }

  try {
    const owner = await createWorkspaceMember({ role: "owner" });
    const reader = await createWorkspaceMember();
    const restricted = await createWorkspaceMember();
    const outsider = await createWorkspaceMember();
    const workspaceId = owner.workspace.id;
    await db.insert(schema.workspaceUserTable).values(
      [reader, restricted].map(({ user }) => ({
        workspaceId,
        userId: user.id,
        role: "member",
        joinedAt: new Date(),
      })),
    );
    await db.insert(schema.workspaceMemberAccessTable).values({
      workspaceId,
      userId: restricted.user.id,
      projectAccess: "selected",
    });
    const { project, columns } = await createProjectFixture({ workspaceId });
    await db.insert(schema.taskTable).values({
      projectId: project.id,
      title: "Assigned work",
      status: "to-do",
      columnId: columns.todo.id,
      userId: reader.user.id,
      number: 1,
    });

    const readerSend = connectUser(reader.user.id);
    const restrictedSend = connectUser(restricted.user.id);
    const outsiderSend = connectUser(outsider.user.id);
    const expectedMessage = JSON.stringify({
      type: "WORKSPACE_PROJECTS_CHANGED",
      workspaceId,
    });
    const { app } = createApp();
    async function readAssignedTotal(countOnly: boolean) {
      mockAuthenticatedSession(reader.user);
      const response = await app.request(
        `/api/task/assigned?workspaceId=${workspaceId}&countOnly=${countOnly}`,
      );
      expect(response.status).toBe(200);
      return ((await response.json()) as { total: number }).total;
    }

    expect(await readAssignedTotal(false)).toBe(1);
    for (const [action, total, deliveries] of [
      ["archive", 0, 1],
      ["unarchive", 1, 2],
    ] as const) {
      mockAuthenticatedSession(owner.user);
      const response = await app.request(
        `/api/project/${project.id}/${action}`,
        { method: "PUT" },
      );
      expect(response.status).toBe(200);
      await expect.poll(() => readerSend.mock.calls).toHaveLength(deliveries);
      expect(readerSend).toHaveBeenLastCalledWith(expectedMessage);
      expect(restrictedSend).not.toHaveBeenCalled();
      expect(outsiderSend).not.toHaveBeenCalled();
      expect(await readAssignedTotal(false)).toBe(total);
      expect(await readAssignedTotal(true)).toBe(total);
    }
  } finally {
    for (const close of disconnect) close();
    await shutdownWebSocketAdapter();
    vi.unstubAllEnvs();
  }
});
