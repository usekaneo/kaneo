import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import {
  adminUserListSchema,
  adminWorkspaceListSchema,
} from "../../apps/api/src/admin/response";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { createInstanceAdmin } from "./helpers/admin/create-instance-admin";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function addSession(
  userId: string,
  createdAt: string,
  updatedAt: string,
  impersonatedBy: string | null = null,
) {
  await db.insert(schema.sessionTable).values({
    id: randomUUID(),
    token: randomUUID(),
    userId,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
    expiresAt: new Date("2025-01-01T00:00:00Z"),
    impersonatedBy,
  });
}

async function addActivity(
  workspaceId: string,
  userId: string,
  createdAt: string,
) {
  const { project } = await createProjectFixture({ workspaceId });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Activity fixture" })
    .returning();
  await db.insert(schema.activityTable).values({
    taskId: task.id,
    userId,
    type: "comment",
    createdAt: new Date(createdAt),
  });
  return task;
}

describe("admin Last Used", () => {
  beforeEach(resetTestDatabase);

  it("uses the newest retained session or activity, excluding impersonation and profile edits", async () => {
    const admin = await createInstanceAdmin();
    const member = await createWorkspaceMember();
    await addSession(
      member.user.id,
      "2026-01-01T00:00:00Z",
      "2026-02-01T00:00:00Z",
    );
    await addSession(
      member.user.id,
      "2026-03-01T00:00:00Z",
      "2026-03-02T00:00:00Z",
    );
    await addSession(
      member.user.id,
      "2026-06-01T00:00:00Z",
      "2026-06-02T00:00:00Z",
      admin.id,
    );
    await addActivity(
      member.workspace.id,
      member.user.id,
      "2026-04-01T00:00:00Z",
    );
    await db
      .update(schema.userTable)
      .set({ updatedAt: new Date("2026-07-01T00:00:00Z") })
      .where(eq(schema.userTable.id, member.user.id));
    mockAuthenticatedSession(admin);
    const { app } = createApp();
    const list = async () => {
      const response = await app.request("/api/admin/users");
      expect(response.status).toBe(200);
      return adminUserListSchema.parse(await response.json());
    };
    expect(
      (await list()).users.find((user) => user.id === member.user.id)
        ?.lastUsedAt,
    ).toBe("2026-04-01T00:00:00.000Z");
    await db.delete(schema.activityTable);
    expect(
      (await list()).users.find((user) => user.id === member.user.id)
        ?.lastUsedAt,
    ).toBe("2026-03-02T00:00:00.000Z");
    expect(
      (await list()).users.find((user) => user.id === admin.id)?.lastUsedAt,
    ).toBeNull();
    await db.delete(schema.sessionTable);
    expect(
      (await list()).users.find((user) => user.id === member.user.id)
        ?.lastUsedAt,
    ).toBeNull();
  });

  it("uses session creation when newer than its refresh timestamp", async () => {
    const admin = await createInstanceAdmin();
    await addSession(admin.id, "2026-03-01T00:00:00Z", "2026-02-01T00:00:00Z");
    mockAuthenticatedSession(admin);
    const response = await createApp().app.request("/api/admin/users?limit=1");
    expect(response.status).toBe(200);
    expect(
      adminUserListSchema.parse(await response.json()).users[0].lastUsedAt,
    ).toBe("2026-03-01T00:00:00.000Z");
  });

  it("scopes workspace activity across its projects and does not infer use from member logins", async () => {
    const admin = await createInstanceAdmin();
    const member = await createWorkspaceMember();
    const other = await createWorkspaceMember();
    await addActivity(
      member.workspace.id,
      member.user.id,
      "2026-02-01T00:00:00Z",
    );
    const newest = await addActivity(
      member.workspace.id,
      member.user.id,
      "2026-04-01T00:00:00Z",
    );
    await addActivity(
      other.workspace.id,
      other.user.id,
      "2026-08-01T00:00:00Z",
    );
    await addSession(
      member.user.id,
      "2026-09-01T00:00:00Z",
      "2026-09-01T00:00:00Z",
    );
    mockAuthenticatedSession(admin);
    const { app } = createApp();
    const list = async () => {
      const response = await app.request("/api/admin/workspaces");
      expect(response.status).toBe(200);
      return adminWorkspaceListSchema.parse(await response.json());
    };
    expect(
      (await list()).workspaces.find(
        (workspace) => workspace.id === member.workspace.id,
      )?.lastUsedAt,
    ).toBe("2026-04-01T00:00:00.000Z");
    await db.delete(schema.taskTable).where(eq(schema.taskTable.id, newest.id));
    expect(
      (await list()).workspaces.find(
        (workspace) => workspace.id === member.workspace.id,
      )?.lastUsedAt,
    ).toBe("2026-02-01T00:00:00.000Z");
    await db.delete(schema.activityTable);
    expect(
      (await list()).workspaces.find(
        (workspace) => workspace.id === member.workspace.id,
      )?.lastUsedAt,
    ).toBeNull();
  });
});
