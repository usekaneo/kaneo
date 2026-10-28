import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import type { PermissionMap } from "../../apps/api/src/utils/role-permissions";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";
import { createReadSurfaceReader } from "./helpers/read-surface-reader";

beforeEach(resetTestDatabase);

async function fixture(
  authentication: "api-key" | "custom-role",
  permissions: PermissionMap,
) {
  const reader = await createReadSurfaceReader(authentication, permissions);
  const { project } = await createProjectFixture({
    workspaceId: reader.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Private task" })
    .returning();
  const [taskNotification, workspaceNotification, personalNotification] =
    await db
      .insert(schema.notificationTable)
      .values([
        {
          userId: reader.user.id,
          resourceType: "task",
          resourceId: task.id,
          title: "Private title",
          content: "Private comment",
          eventData: {
            taskTitle: task.title,
            commentPreview: "Private preview",
          },
        },
        {
          userId: reader.user.id,
          resourceType: "workspace",
          resourceId: reader.workspace.id,
          eventData: { workspaceName: "Private workspace" },
        },
        { userId: reader.user.id, title: "Personal message" },
      ])
      .returning();
  return {
    ...reader,
    task,
    taskNotification,
    workspaceNotification,
    personalNotification,
    ...createApp(),
  };
}

describe("notification response current read grants", () => {
  for (const authentication of ["api-key", "custom-role"] as const) {
    it.each<PermissionMap>([
      {},
      { label: ["read"] },
      { project: ["read"] },
      { task: ["read"] },
      { workspace: ["read"] },
      { task: ["read"], workspace: ["read"] },
    ])(`${authentication} filters full rows with %j`, async (permissions) => {
      const {
        app,
        headers,
        workspace,
        taskNotification,
        workspaceNotification,
        personalNotification,
      } = await fixture(authentication, permissions);
      const cases = [
        {
          notification: taskNotification,
          allowed: permissions.task?.includes("read") ?? false,
        },
        {
          notification: workspaceNotification,
          allowed: permissions.workspace?.includes("read") ?? false,
        },
        { notification: personalNotification, allowed: true },
      ];
      for (const query of ["", `?workspaceId=${workspace.id}`]) {
        const response = await app.request(`/api/notification${query}`, {
          headers,
        });
        expect(response.status).toBe(200);
        const rows = await response.json();
        expect(rows.map((row: { id: string }) => row.id).sort()).toEqual(
          cases
            .filter(({ allowed }) => allowed)
            .map(({ notification }) => notification.id)
            .sort(),
        );
        if (!permissions.task?.includes("read")) {
          expect(JSON.stringify(rows)).not.toContain("Private preview");
        }
      }
      for (const { notification, allowed } of cases) {
        for (const state of ["read", "unread"]) {
          // Start denied unread from true to catch mutation-before-denial bugs.
          const previous = state === "unread";
          await db
            .update(schema.notificationTable)
            .set({ isRead: previous })
            .where(eq(schema.notificationTable.id, notification.id));
          const response = await app.request(
            `/api/notification/${notification.id}/${state}`,
            { method: "PATCH", headers },
          );
          expect(response.status).toBe(allowed ? 200 : 404);
          if (allowed) {
            expect(await response.json()).toMatchObject({
              id: notification.id,
              isRead: state === "read",
            });
          } else {
            expect(await response.text()).not.toContain("Private");
            expect(
              await db.query.notificationTable.findFirst({
                where: eq(schema.notificationTable.id, notification.id),
              }),
            ).toHaveProperty("isRead", previous);
          }
        }
      }
    });

    it(`${authentication} rechecks historical rows after role demotion`, async () => {
      const {
        app,
        headers,
        role,
        taskNotification,
        workspaceNotification,
        personalNotification,
      } = await fixture(authentication, {
        task: ["read"],
        workspace: ["read"],
      });
      const before = await app.request("/api/notification", { headers });
      expect((await before.json()).length).toBe(3);
      await db
        .update(schema.workspaceRoleTable)
        .set({ permission: "{}" })
        .where(eq(schema.workspaceRoleTable.id, role.id));
      const after = await app.request("/api/notification", { headers });
      expect(await after.json()).toEqual([
        expect.objectContaining({ id: personalNotification.id }),
      ]);
      for (const notification of [taskNotification, workspaceNotification]) {
        for (const state of ["read", "unread"]) {
          const response = await app.request(
            `/api/notification/${notification.id}/${state}`,
            { method: "PATCH", headers },
          );
          expect(response.status).toBe(404);
          expect(await response.text()).not.toContain("Private");
        }
      }
    });
  }

  it("keeps another user's rows private even with the resource read grants", async () => {
    const { app, headers, task, taskNotification } = await fixture("api-key", {
      task: ["read"],
      workspace: ["read"],
    });
    const other = await createWorkspaceMember();
    const foreign = await db
      .insert(schema.notificationTable)
      .values([
        { userId: other.user.id, title: "Other personal message" },
        {
          userId: other.user.id,
          resourceId: task.id,
          resourceType: "task",
          eventData: { commentPreview: "Other private preview" },
        },
      ])
      .returning();
    const response = await app.request("/api/notification", { headers });
    const rows = await response.json();
    expect(rows).toContainEqual(
      expect.objectContaining({ id: taskNotification.id }),
    );
    for (const notification of foreign) {
      expect(rows).not.toContainEqual(
        expect.objectContaining({ id: notification.id }),
      );
      for (const state of ["read", "unread"]) {
        const previous = state === "unread";
        await db
          .update(schema.notificationTable)
          .set({ isRead: previous })
          .where(eq(schema.notificationTable.id, notification.id));
        const result = await app.request(
          `/api/notification/${notification.id}/${state}`,
          { method: "PATCH", headers },
        );
        expect(result.status).toBe(404);
        expect(await result.text()).not.toContain("Other");
        expect(
          await db.query.notificationTable.findFirst({
            where: eq(schema.notificationTable.id, notification.id),
          }),
        ).toHaveProperty("isRead", previous);
      }
    }
  });

  it("filters each workspace before the limit and follows the task's current workspace instead of eventData", async () => {
    const {
      app,
      headers,
      workspace,
      user,
      task,
      taskNotification,
      personalNotification,
    } = await fixture("api-key", { task: ["read"] });
    const other = await createWorkspaceMember();
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: other.workspace.id,
      userId: user.id,
      role: "limited",
      joinedAt: new Date(),
    });
    await db.insert(schema.workspaceRoleTable).values({
      workspaceId: other.workspace.id,
      role: "limited",
      permission: "{}",
    });
    const { project } = await createProjectFixture({
      workspaceId: other.workspace.id,
    });
    const [hiddenTask] = await db
      .insert(schema.taskTable)
      .values({ projectId: project.id, title: "Hidden task", number: 2 })
      .returning();
    await db.insert(schema.notificationTable).values(
      Array.from({ length: 55 }, () => ({
        userId: user.id,
        resourceId: hiddenTask.id,
        resourceType: "task",
        createdAt: new Date(Date.now() + 10_000),
        eventData: { workspaceId: workspace.id, taskTitle: "Hidden title" },
      })),
    );
    const list = async (query = "") =>
      (await app.request(`/api/notification${query}`, { headers })).json();
    expect((await list()).map((row: { id: string }) => row.id).sort()).toEqual(
      [taskNotification.id, personalNotification.id].sort(),
    );
    expect(await list(`?workspaceId=${other.workspace.id}`)).toEqual([
      expect.objectContaining({ id: personalNotification.id }),
    ]);
    await db
      .update(schema.taskTable)
      .set({ projectId: project.id })
      .where(eq(schema.taskTable.id, task.id));
    expect(await list()).toEqual([
      expect.objectContaining({ id: personalNotification.id }),
    ]);
    expect(
      (
        await app.request(`/api/notification/${taskNotification.id}/read`, {
          method: "PATCH",
          headers,
        })
      ).status,
    ).toBe(404);
  });
});
