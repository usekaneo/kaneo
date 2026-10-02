import { beforeEach, describe, expect, it } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

async function fixture() {
  const member = await createWorkspaceMember();
  const other = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: other.workspace.id,
    userId: member.user.id,
    role: "member",
    joinedAt: new Date(),
  });
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Local task",
    })
    .returning();
  const [local, workspace, foreign, anotherUser] = await db
    .insert(schema.notificationTable)
    .values([
      {
        userId: member.user.id,
        resourceType: "task",
        resourceId: task.id,
        eventData: { workspaceId: other.workspace.id },
        createdAt: new Date(0),
      },
      {
        userId: member.user.id,
        resourceType: "workspace",
        resourceId: member.workspace.id,
      },
      {
        userId: member.user.id,
        resourceType: "workspace",
        resourceId: other.workspace.id,
      },
      {
        userId: other.user.id,
        resourceType: "workspace",
        resourceId: member.workspace.id,
      },
    ])
    .returning();
  mockAuthenticatedSession(member.user);
  return {
    member,
    other,
    local,
    workspace,
    foreign,
    anotherUser,
    app: createApp().app,
  };
}

describe("workspace inbox", () => {
  beforeEach(resetTestDatabase);

  it("filters by current resources before the limit and ignores forged event data", async () => {
    const { member, other, local, workspace, app } = await fixture();
    await db.insert(schema.notificationTable).values(
      Array.from({ length: 60 }, () => ({
        userId: member.user.id,
        resourceType: "workspace",
        resourceId: other.workspace.id,
      })),
    );
    const response = await app.request(
      `/api/notification?workspaceId=${member.workspace.id}`,
    );
    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as Array<{ id: string }>).map((n) => n.id),
    ).toEqual([workspace.id, local.id]);
  });

  it("marks and clears only this user's notifications in the selected workspace", async () => {
    const { member, local, workspace, foreign, anotherUser, app } =
      await fixture();
    const query = `?workspaceId=${member.workspace.id}`;
    const marked = await app.request(`/api/notification/read-all${query}`, {
      method: "PATCH",
    });
    expect(marked.status).toBe(200);
    const rows = await db.select().from(schema.notificationTable);
    expect(
      rows
        .filter((n) => n.isRead)
        .map((n) => n.id)
        .sort(),
    ).toEqual([local.id, workspace.id].sort());
    const cleared = await app.request(`/api/notification/clear-all${query}`, {
      method: "DELETE",
    });
    expect(cleared.status).toBe(200);
    expect(
      (await db.select().from(schema.notificationTable))
        .map((n) => n.id)
        .sort(),
    ).toEqual([foreign.id, anotherUser.id].sort());
  });

  it("keeps resource-less integration alerts accessible in workspace inboxes", async () => {
    const { member, other, app } = await fixture();
    const [global] = await db
      .insert(schema.notificationTable)
      .values({
        userId: member.user.id,
        title: "Integration alert",
      })
      .returning();
    for (const workspaceId of [member.workspace.id, other.workspace.id]) {
      const response = await app.request(
        `/api/notification?workspaceId=${workspaceId}`,
      );
      expect(await response.json()).toEqual(
        expect.arrayContaining([expect.objectContaining({ id: global.id })]),
      );
    }
    await app.request(
      `/api/notification/read-all?workspaceId=${member.workspace.id}`,
      { method: "PATCH" },
    );
    expect(
      (await db.select().from(schema.notificationTable)).find(
        (n) => n.id === global.id,
      )?.isRead,
    ).toBe(true);
    await app.request(
      `/api/notification/clear-all?workspaceId=${other.workspace.id}`,
      { method: "DELETE" },
    );
    expect(
      (await db.select().from(schema.notificationTable)).some(
        (n) => n.id === global.id,
      ),
    ).toBe(false);
  });

  it("keeps the unscoped API compatible and rejects empty workspace filters", async () => {
    const { local, workspace, foreign, app } = await fixture();
    const response = await app.request("/api/notification");
    expect(
      ((await response.json()) as Array<{ id: string }>)
        .map((n) => n.id)
        .sort(),
    ).toEqual([local.id, workspace.id, foreign.id].sort());
    for (const [path, method] of [
      ["", "GET"],
      ["/read-all", "PATCH"],
      ["/clear-all", "DELETE"],
    ]) {
      expect(
        (await app.request(`/api/notification${path}?workspaceId=`, { method }))
          .status,
      ).toBe(400);
    }
  });
});
