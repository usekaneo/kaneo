import { inArray } from "drizzle-orm";
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
  demote: boolean,
) {
  const reader = await createReadSurfaceReader(authentication, permissions);
  const { project } = await createProjectFixture({
    workspaceId: reader.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Private task" })
    .returning();
  const other = await createWorkspaceMember();
  const notifications = await db
    .insert(schema.notificationTable)
    .values([
      {
        userId: reader.user.id,
        resourceType: "task",
        resourceId: task.id,
      },
      {
        userId: reader.user.id,
        resourceType: "workspace",
        resourceId: reader.workspace.id,
      },
      { userId: reader.user.id },
      { userId: other.user.id },
      {
        userId: other.user.id,
        resourceType: "task",
        resourceId: task.id,
      },
    ])
    .returning();
  if (demote) {
    await db
      .update(schema.workspaceRoleTable)
      .set({ permission: "{}" })
      .where(inArray(schema.workspaceRoleTable.id, [reader.role.id]));
  }
  const currentPermissions: PermissionMap = demote ? {} : permissions;
  const allowed = [
    currentPermissions.task?.includes("read") ?? false,
    currentPermissions.workspace?.includes("read") ?? false,
    true,
    false,
    false,
  ];
  const ids = notifications.map(({ id }) => id);
  const rows = () =>
    db.query.notificationTable.findMany({
      where: inArray(schema.notificationTable.id, ids),
    });
  const reset = async (read: boolean) => {
    await db
      .delete(schema.notificationTable)
      .where(inArray(schema.notificationTable.id, ids));
    await db.insert(schema.notificationTable).values(
      notifications.map((notification, index) => ({
        ...notification,
        // Leave one accessible row unread to distinguish clear-read from clear-all.
        isRead: read && index !== 2,
      })),
    );
  };
  return { ...reader, ...createApp(), notifications, allowed, rows, reset };
}

describe("notification mutation current read grants", () => {
  for (const authentication of ["api-key", "custom-role"] as const) {
    for (const queryWorkspace of [false, true]) {
      it.each<PermissionMap>([
        {},
        { label: ["read"] },
        { task: ["read"] },
        { workspace: ["read"] },
        { task: ["read"], workspace: ["read"] },
      ])(
        `${authentication} filters writes with %j and workspace query ${queryWorkspace}`,
        async (permissions) => {
          await verifyMutations(
            await fixture(authentication, permissions, false),
            queryWorkspace,
          );
        },
      );

      it(`${authentication} rechecks revoked roles with workspace query ${queryWorkspace}`, async () => {
        await verifyMutations(
          await fixture(
            authentication,
            { task: ["read"], workspace: ["read"] },
            true,
          ),
          queryWorkspace,
        );
      });
    }
  }
});

async function verifyMutations(
  context: Awaited<ReturnType<typeof fixture>>,
  queryWorkspace: boolean,
) {
  const { app, headers, workspace, notifications, allowed, rows, reset } =
    context;
  const query = queryWorkspace ? `?workspaceId=${workspace.id}` : "";
  await reset(false);
  const readAll = await app.request(`/api/notification/read-all${query}`, {
    method: "PATCH",
    headers,
  });
  expect(readAll.status).toBe(200);
  const marked = await rows();
  for (const [index, notification] of notifications.entries()) {
    expect(marked.find(({ id }) => id === notification.id)?.isRead).toBe(
      allowed[index],
    );
  }

  for (const operation of ["clear-read", "clear-all"]) {
    await reset(true);
    const response = await app.request(
      `/api/notification/${operation}${query}`,
      { method: "DELETE", headers },
    );
    expect(response.status).toBe(200);
    expect((await rows()).map(({ id }) => id).sort()).toEqual(
      notifications
        .filter(
          (_, index) =>
            !allowed[index] || (operation === "clear-read" && index === 2),
        )
        .map(({ id }) => id)
        .sort(),
    );
  }

  await reset(false);
  for (const [index, notification] of notifications.entries()) {
    const response = await app.request(`/api/notification/${notification.id}`, {
      method: "DELETE",
      headers,
    });
    expect(response.status).toBe(allowed[index] ? 200 : 404);
    expect((await rows()).some(({ id }) => id === notification.id)).toBe(
      !allowed[index],
    );
  }
}
