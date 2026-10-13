import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import type { WSContext } from "hono/ws";
import { auth } from "../../apps/api/src/auth";
import {
  addConnection,
  addUserConnection,
  removeUserConnection,
  removeConnection,
} from "../../apps/api/src/ws";
import db, { getDatabase, schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import deleteAccountData from "../../apps/api/src/user/controllers/delete-account-data";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function addMember(workspaceId: string, role: string) {
  const userId = `user-${randomUUID()}`;

  const [user] = await db
    .insert(schema.userTable)
    .values({
      id: userId,
      email: `${userId}@example.com`,
      emailVerified: true,
      name: "Other Member",
    })
    .returning();

  await db.insert(schema.workspaceUserTable).values({
    workspaceId,
    userId: user.id,
    role,
    joinedAt: new Date(),
  });

  return user;
}

describe("API integration: account deletion", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("deletes a workspace the account is the only member of", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });

    await deleteAccountData(owner.user.id);

    const workspaces = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, owner.workspace.id));

    expect(workspaces).toHaveLength(0);
  });

  it("revokes implicit administrators when deleting a sole-member workspace", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const admin = await createWorkspaceMember();
    await db
      .update(schema.userTable)
      .set({ role: "user,admin" })
      .where(eq(schema.userTable.id, admin.user.id));
    const { project } = await createProjectFixture({
      workspaceId: owner.workspace.id,
    });
    const board = { send: vi.fn(), close: vi.fn() };
    const global = { send: vi.fn(), close: vi.fn() };
    const projectConnection = addConnection(
      project.id,
      board as unknown as WSContext,
      admin.user.id,
      "window",
      owner.workspace.id,
    );
    const userConnection = addUserConnection(
      admin.user.id,
      global as unknown as WSContext,
    );
    try {
      await deleteAccountData(owner.user.id);
      expect(board.close).toHaveBeenCalledWith(
        1008,
        "Workspace access revoked",
      );
      expect(
        global.send.mock.calls.map(([message]) => JSON.parse(message)),
      ).toContainEqual({
        type: "WORKSPACE_ACCESS_REVOKED",
        workspaceId: owner.workspace.id,
      });
      expect(
        await db.query.workspaceTable.findFirst({
          where: eq(schema.workspaceTable.id, owner.workspace.id),
        }),
      ).toBeUndefined();
      expect(
        await db.query.workspaceTable.findFirst({
          where: eq(schema.workspaceTable.id, admin.workspace.id),
        }),
      ).toBeDefined();
    } finally {
      removeConnection(project.id, projectConnection);
      removeUserConnection(admin.user.id, userConnection);
    }
  });

  it("refuses to delete while the account is the only owner of a shared workspace", async () => {
    const owner = await createWorkspaceMember({
      role: "owner",
      workspaceName: "Acme",
    });
    await addMember(owner.workspace.id, "member");

    await expect(deleteAccountData(owner.user.id)).rejects.toThrow(
      /only owner of "Acme"/,
    );

    const workspaces = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, owner.workspace.id));

    expect(workspaces).toHaveLength(1);
  });

  it.each([false, true])(
    "revokes project sockets after leaving even if the old post-delete lookup fails (%s)",
    async (failLookup) => {
      const owner = await createWorkspaceMember({ role: "owner" });
      const member = await addMember(owner.workspace.id, "member");
      const token = `leave-${randomUUID()}`;
      await db.insert(schema.sessionTable).values({
        id: randomUUID(),
        userId: member.id,
        token,
        expiresAt: new Date(Date.now() + 60_000),
      });
      const ws = { send: vi.fn(), close: vi.fn() };
      const conn = addConnection(
        "project",
        ws as unknown as WSContext,
        member.id,
        "window",
        owner.workspace.id,
      );
      const select = getDatabase().select.bind(getDatabase());
      const injected = failLookup
        ? vi.spyOn(getDatabase(), "select").mockImplementation((fields) => {
            if (
              fields &&
              Object.keys(fields).length === 1 &&
              fields.id === schema.workspaceUserTable.id
            )
              throw new Error("Post-delete membership lookup unavailable");
            return select(fields);
          })
        : undefined;
      try {
        const response = await auth.handler(
          new Request("http://localhost:1337/api/auth/organization/leave", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ organizationId: owner.workspace.id }),
          }),
        );
        expect(response.status).toBe(200);
        expect(ws.close).toHaveBeenCalledWith(1008, "Workspace access revoked");
      } finally {
        injected?.mockRestore();
        removeConnection("project", conn);
      }
    },
  );

  it("revokes other members after deleting a workspace through Better Auth", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const member = await addMember(owner.workspace.id, "member");
    const token = `delete-${randomUUID()}`;
    await db.insert(schema.sessionTable).values({
      id: randomUUID(),
      userId: owner.user.id,
      token,
      expiresAt: new Date(Date.now() + 60_000),
    });
    const ws = { send: vi.fn(), close: vi.fn() };
    const conn = addConnection(
      "project",
      ws as unknown as WSContext,
      member.id,
      "window",
      owner.workspace.id,
    );
    try {
      const response = await auth.handler(
        new Request("http://localhost:1337/api/auth/organization/delete", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ organizationId: owner.workspace.id }),
        }),
      );
      expect(response.status).toBe(200);
      expect(ws.close).toHaveBeenCalledWith(1008, "Workspace access revoked");
      expect(
        await db.query.workspaceTable.findFirst({
          where: eq(schema.workspaceTable.id, owner.workspace.id),
        }),
      ).toBeUndefined();
    } finally {
      removeConnection("project", conn);
    }
  });

  it("revokes project sockets during account deletion", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    const member = await addMember(owner.workspace.id, "member");
    const ws = { send: vi.fn(), close: vi.fn() };
    const conn = addConnection(
      "project",
      ws as unknown as WSContext,
      member.id,
      "window",
      owner.workspace.id,
    );
    try {
      await deleteAccountData(member.id);
      expect(ws.close).toHaveBeenCalledWith(1008, "Workspace access revoked");
    } finally {
      removeConnection("project", conn);
    }
  });

  it("leaves a shared workspace that keeps another owner", async () => {
    const owner = await createWorkspaceMember({ role: "owner" });
    await addMember(owner.workspace.id, "owner");

    await deleteAccountData(owner.user.id);

    const workspaces = await db
      .select()
      .from(schema.workspaceTable)
      .where(eq(schema.workspaceTable.id, owner.workspace.id));
    const members = await db
      .select()
      .from(schema.workspaceUserTable)
      .where(eq(schema.workspaceUserTable.userId, owner.user.id));

    expect(workspaces).toHaveLength(1);
    expect(members).toHaveLength(0);
  });

  it("keeps tasks, time entries, and activity of another workspace after the user row is deleted", async () => {
    const host = await createWorkspaceMember({ role: "owner" });
    const guest = await addMember(host.workspace.id, "member");
    const { project } = await createProjectFixture({
      workspaceId: host.workspace.id,
    });

    const [task] = await db
      .insert(schema.taskTable)
      .values({
        projectId: project.id,
        userId: guest.id,
        title: "Assigned to the leaving user",
        status: "to-do",
        priority: "medium",
        number: 1,
        position: 1,
      })
      .returning();

    const [timeEntry] = await db
      .insert(schema.timeEntryTable)
      .values({
        taskId: task.id,
        userId: guest.id,
        startTime: new Date(),
        duration: 60,
      })
      .returning();

    const [activity] = await db
      .insert(schema.activityTable)
      .values({
        taskId: task.id,
        userId: guest.id,
        type: "comment",
        content: "Worth keeping",
      })
      .returning();

    await deleteAccountData(guest.id);
    await db.delete(schema.userTable).where(eq(schema.userTable.id, guest.id));

    const [remainingTask] = await db
      .select()
      .from(schema.taskTable)
      .where(eq(schema.taskTable.id, task.id));
    const [remainingTimeEntry] = await db
      .select()
      .from(schema.timeEntryTable)
      .where(eq(schema.timeEntryTable.id, timeEntry.id));
    const [remainingActivity] = await db
      .select()
      .from(schema.activityTable)
      .where(eq(schema.activityTable.id, activity.id));

    expect(remainingTask?.title).toBe("Assigned to the leaving user");
    expect(remainingTask?.userId).toBeNull();
    expect(remainingTimeEntry?.duration).toBe(60);
    expect(remainingTimeEntry?.userId).toBeNull();
    expect(remainingActivity?.content).toBe("Worth keeping");
    expect(remainingActivity?.userId).toBeNull();
  });

  it("removes the stored avatar with the account", async () => {
    const member = await createWorkspaceMember({ role: "owner" });

    const [avatar] = await db
      .insert(schema.userAvatarTable)
      .values({
        userId: member.user.id,
        mimeType: "image/png",
        size: 8,
        data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      })
      .returning();

    await db
      .delete(schema.userTable)
      .where(eq(schema.userTable.id, member.user.id));

    const avatars = await db
      .select()
      .from(schema.userAvatarTable)
      .where(eq(schema.userAvatarTable.id, avatar.id));

    expect(avatars).toHaveLength(0);
  });
});

describe("API integration: avatar routes", () => {
  beforeEach(async () => {
    await resetTestDatabase();
  });

  it("stores an uploaded avatar and serves it back without authentication", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const png = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x01, 0x02,
    ]);

    const uploadResponse = await app.request("/api/user/avatar", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: "image/png",
        data: png.toString("base64"),
      }),
    });

    expect(uploadResponse.status).toBe(200);
    const avatar = (await uploadResponse.json()) as {
      id: string;
      url: string;
      size: number;
    };
    expect(avatar.url).toBe(`/api/user/avatar/${avatar.id}`);
    expect(avatar.size).toBe(png.length);

    const downloadResponse = await app.request(avatar.url);

    expect(downloadResponse.status).toBe(200);
    expect(downloadResponse.headers.get("content-type")).toBe("image/png");
    expect(downloadResponse.headers.get("x-content-type-options")).toBe(
      "nosniff",
    );
    expect(Buffer.from(await downloadResponse.arrayBuffer())).toEqual(png);
  });

  it("rejects bytes that do not match the declared image type", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const response = await app.request("/api/user/avatar", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: "image/png",
        data: Buffer.from("<html></html>").toString("base64"),
      }),
    });

    expect(response.status).toBe(400);
  });

  it("replaces the previous avatar and retires its URL", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    const upload = (contentType: string, data: Buffer) =>
      app.request("/api/user/avatar", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          contentType,
          data: data.toString("base64"),
        }),
      });

    const first = (await (
      await upload(
        "image/png",
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      )
    ).json()) as { id: string; url: string };

    const second = (await (
      await upload("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0x01]))
    ).json()) as { id: string; url: string };

    expect(second.id).not.toBe(first.id);
    expect((await app.request(first.url)).status).toBe(404);
    expect((await app.request(second.url)).status).toBe(200);

    const rows = await db
      .select()
      .from(schema.userAvatarTable)
      .where(eq(schema.userAvatarTable.userId, member.user.id));
    expect(rows).toHaveLength(1);
  });

  it("deletes the avatar of the current user", async () => {
    const member = await createWorkspaceMember({ role: "owner" });
    mockAuthenticatedSession(member.user);
    const { app } = createApp();

    await app.request("/api/user/avatar", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contentType: "image/png",
        data: Buffer.from([
          0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        ]).toString("base64"),
      }),
    });

    const response = await app.request("/api/user/avatar", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ deleted: true });

    const rows = await db
      .select()
      .from(schema.userAvatarTable)
      .where(eq(schema.userAvatarTable.userId, member.user.id));
    expect(rows).toHaveLength(0);
  });

  it("requires authentication to upload an avatar", async () => {
    const { app } = createApp();

    const response = await app.request("/api/user/avatar", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ contentType: "image/png", data: "" }),
    });

    expect(response.status).toBe(401);
  });
});

it("revokes an administrator's implicit workspace and user sockets after account deletion commits", async () => {
  const { workspace } = await createWorkspaceMember();
  const { project } = await createProjectFixture({ workspaceId: workspace.id });
  const [admin] = await db
    .insert(schema.userTable)
    .values({
      id: randomUUID(),
      email: `${randomUUID()}@example.com`,
      name: "Admin",
      role: "admin",
      emailVerified: true,
    })
    .returning();
  const token = randomUUID();
  await db.insert(schema.sessionTable).values({
    id: randomUUID(),
    userId: admin.id,
    token,
    expiresAt: new Date(Date.now() + 60_000),
  });
  const projectWs = { send: vi.fn(), close: vi.fn() };
  const userWs = { send: vi.fn(), close: vi.fn() };
  const conn = addConnection(
    project.id,
    projectWs as unknown as WSContext,
    admin.id,
    "window",
    workspace.id,
  );
  const userConn = addUserConnection(admin.id, userWs as unknown as WSContext);
  try {
    const response = await auth.handler(
      new Request("http://localhost:1337/api/auth/delete-user", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${token}`,
        },
        body: "{}",
      }),
    );
    expect(response.status).toBe(200);
    expect(
      await db.query.userTable.findFirst({
        where: eq(schema.userTable.id, admin.id),
      }),
    ).toBeUndefined();
    expect(projectWs.close).toHaveBeenCalledWith(1008, "User access revoked");
    expect(userWs.send).toHaveBeenCalledWith(
      JSON.stringify({ type: "USER_ACCESS_REVOKED" }),
    );
    expect(userWs.close).toHaveBeenCalledWith(1008, "User access revoked");
  } finally {
    removeConnection(project.id, conn);
    removeUserConnection(admin.id, userConn);
  }
});
