import { eq } from "drizzle-orm";
import { beforeEach, expect, it, vi } from "vite-plus/test";
import db, { schema } from "../../apps/api/src/database";
import getPreview from "../../apps/api/src/task/controllers/subtask-status-preview";
import updateSubtasks from "../../apps/api/src/task/controllers/update-subtask-statuses";
import updateStatus from "../../apps/api/src/task/controllers/update-task-status";
import reorderTasks from "../../apps/api/src/task/controllers/reorder-tasks";
import bulkUpdate from "../../apps/api/src/task/controllers/bulk-update-tasks";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const publish = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<typeof import("../../apps/api/src/events")>()),
  publishEvent: publish,
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});
async function fixture() {
  const { user, workspace } = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: workspace.id,
  });
  const tasks = await db
    .insert(schema.taskTable)
    .values(
      [
        {
          projectId: project.id,
          title: "Parent",
          status: "to-do",
          position: 0,
        },
        {
          projectId: project.id,
          title: "Child",
          status: "in-progress",
          position: 1,
        },
        {
          projectId: project.id,
          title: "Grandchild",
          status: "to-do",
          position: 2,
        },
        {
          projectId: project.id,
          title: "Completed child",
          status: "done",
          position: 3,
        },
        {
          projectId: project.id,
          title: "Archived child",
          status: "archived",
          position: 4,
        },
        {
          projectId: project.id,
          title: "Unrelated",
          status: "to-do",
          position: 5,
        },
      ].map((task, index) => ({ ...task, number: index + 1 })),
    )
    .returning();
  const [parent, child, grandchild, completed, archived, unrelated] = tasks;
  await db.insert(schema.taskRelationTable).values([
    {
      sourceTaskId: parent.id,
      targetTaskId: child.id,
      relationType: "subtask",
    },
    {
      sourceTaskId: child.id,
      targetTaskId: grandchild.id,
      relationType: "subtask",
    },
    {
      sourceTaskId: parent.id,
      targetTaskId: completed.id,
      relationType: "subtask",
    },
    {
      sourceTaskId: parent.id,
      targetTaskId: archived.id,
      relationType: "subtask",
    },
  ]);
  return {
    user,
    workspace,
    project,
    columns,
    parent,
    child,
    grandchild,
    completed,
    archived,
    unrelated,
  };
}
it.each(["status", "drag", "bulk"])(
  "%s saves the parent without implicitly changing descendants",
  async (mode) => {
    const f = await fixture();
    if (mode === "status")
      await updateStatus({
        id: f.parent.id,
        status: "done",
        currentUserId: f.user.id,
      });
    if (mode === "drag")
      await reorderTasks(
        f.project.id,
        [{ id: f.parent.id, status: "done", position: 6 }],
        f.user.id,
      );
    if (mode === "bulk")
      await bulkUpdate({
        taskIds: [f.parent.id],
        operation: "updateStatus",
        value: "done",
        userId: f.user.id,
      });
    const preview = await getPreview(
      f.parent.id,
      "done",
      f.user.id,
      f.workspace.id,
    );
    expect(preview.subtasks.map((task) => task.id).sort()).toEqual(
      [f.child.id, f.grandchild.id].sort(),
    );
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, f.child.id),
        })
      )?.status,
    ).toBe("in-progress");
    expect(
      (
        await db.query.taskTable.findFirst({
          where: eq(schema.taskTable.id, f.grandchild.id),
        })
      )?.status,
    ).toBe("to-do");
  },
);
it.each(["done", "archived"])(
  "confirmation updates only open descendants to %s and publishes each change",
  async (status) => {
    const f = await fixture();
    await updateStatus({ id: f.parent.id, status, currentUserId: f.user.id });
    // A legacy cycle must neither loop forever nor include the parent.
    await db.insert(schema.taskRelationTable).values({
      sourceTaskId: f.grandchild.id,
      targetTaskId: f.parent.id,
      relationType: "subtask",
    });
    publish.mockClear();
    expect(
      await updateSubtasks(
        f.parent.id,
        status,
        [
          f.child.id,
          f.grandchild.id,
          f.completed.id,
          f.archived.id,
          f.unrelated.id,
        ],
        f.user.id,
        f.workspace.id,
      ),
    ).toMatchObject({ updatedCount: 2 });
    const tasks = await db.query.taskTable.findMany();
    const byId = new Map(tasks.map((task) => [task.id, task]));
    expect(byId.get(f.child.id)?.status).toBe(status);
    expect(byId.get(f.grandchild.id)?.status).toBe(status);
    expect(byId.get(f.completed.id)?.status).toBe("done");
    expect(byId.get(f.archived.id)?.status).toBe("archived");
    expect(byId.get(f.unrelated.id)?.status).toBe("to-do");
    for (const task of [f.child, f.grandchild])
      expect(publish).toHaveBeenCalledWith(
        "task.status_changed",
        expect.objectContaining({ taskId: task.id, newStatus: status }),
      );
  },
);
it("preserves tasks closed since preview and ignores children added after confirmation", async () => {
  const f = await fixture();
  await updateStatus({
    id: f.parent.id,
    status: "done",
    currentUserId: f.user.id,
  });
  const preview = await getPreview(
    f.parent.id,
    "done",
    f.user.id,
    f.workspace.id,
  );
  await updateStatus({
    id: f.child.id,
    status: "archived",
    currentUserId: f.user.id,
  });
  await db.insert(schema.taskRelationTable).values({
    sourceTaskId: f.parent.id,
    targetTaskId: f.unrelated.id,
    relationType: "subtask",
  });
  await updateSubtasks(
    f.parent.id,
    "done",
    preview.subtasks.map((task) => task.id),
    f.user.id,
    f.workspace.id,
  );
  expect(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, f.child.id),
      })
    )?.status,
  ).toBe("archived");
  expect(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, f.unrelated.id),
      })
    )?.status,
  ).toBe("to-do");
});
it("uses final columns in other projects and rejects missing final columns atomically", async () => {
  const f = await fixture();
  const other = await createProjectFixture({ workspaceId: f.workspace.id });
  await db
    .update(schema.columnTable)
    .set({ slug: "shipped" })
    .where(eq(schema.columnTable.id, other.columns.done.id));
  await db
    .update(schema.taskTable)
    .set({ projectId: other.project.id })
    .where(eq(schema.taskTable.id, f.grandchild.id));
  await updateStatus({
    id: f.parent.id,
    status: "done",
    currentUserId: f.user.id,
  });
  const preview = await getPreview(
    f.parent.id,
    "done",
    f.user.id,
    f.workspace.id,
  );
  expect(
    preview.subtasks.find((task) => task.id === f.grandchild.id)
      ?.destinationStatus,
  ).toBe("shipped");
  await db
    .update(schema.columnTable)
    .set({ isFinal: false })
    .where(eq(schema.columnTable.id, other.columns.done.id));
  await expect(
    updateSubtasks(
      f.parent.id,
      "done",
      [f.child.id, f.grandchild.id],
      f.user.id,
      f.workspace.id,
    ),
  ).rejects.toThrow("no Done column");
  expect(
    (
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, f.child.id),
      })
    )?.status,
  ).toBe("in-progress");
});
it("rejects stale parent confirmation and does not offer ordinary status cascades", async () => {
  const f = await fixture();
  expect(
    (await getPreview(f.parent.id, "to-do", f.user.id, f.workspace.id))
      .subtasks,
  ).toEqual([]);
  await expect(
    updateSubtasks(
      f.parent.id,
      "done",
      [f.child.id],
      f.user.id,
      f.workspace.id,
    ),
  ).rejects.toThrow("Parent status changed");
});
it("does not traverse inaccessible projects or leak their descendants", async () => {
  const f = await fixture();
  const other = await createProjectFixture({ workspaceId: f.workspace.id });
  await db
    .update(schema.taskTable)
    .set({ projectId: other.project.id })
    .where(eq(schema.taskTable.id, f.child.id));
  await db.insert(schema.workspaceMemberAccessTable).values({
    userId: f.user.id,
    workspaceId: f.workspace.id,
    projectAccess: "selected",
  });
  await db.insert(schema.workspaceMemberProjectTable).values({
    userId: f.user.id,
    workspaceId: f.workspace.id,
    projectId: f.project.id,
  });
  await updateStatus({
    id: f.parent.id,
    status: "done",
    currentUserId: f.user.id,
  });
  expect(
    (await getPreview(f.parent.id, "done", f.user.id, f.workspace.id)).subtasks,
  ).toEqual([]);
  expect(
    await updateSubtasks(
      f.parent.id,
      "done",
      [f.child.id, f.grandchild.id],
      f.user.id,
      f.workspace.id,
    ),
  ).toMatchObject({ updatedCount: 0 });
});
it("requires task:update permission for both preview and confirmation routes", async () => {
  const f = await fixture();
  await db.update(schema.workspaceUserTable).set({ role: "reader" });
  await db.insert(schema.workspaceRoleTable).values({
    workspaceId: f.workspace.id,
    role: "reader",
    permission: JSON.stringify({ task: ["read"] }),
  });
  mockAuthenticatedSession(f.user);
  const { app } = createApp();
  for (const method of ["GET", "PUT"]) {
    const response = await app.request(
      `/api/task/subtask-status/${f.parent.id}${method === "GET" ? "?status=done" : ""}`,
      {
        method,
        headers: { "Content-Type": "application/json" },
        ...(method === "PUT"
          ? { body: JSON.stringify({ status: "done", taskIds: [f.child.id] }) }
          : {}),
      },
    );
    expect(response.status).toBe(403);
  }
});

it("notifies the parent assignee and emits the child-assignee status event", async () => {
  const f = await fixture();
  const assignees = await db
    .insert(schema.userTable)
    .values([
      {
        id: "parent-assignee",
        email: "parent@example.com",
        name: "Parent assignee",
      },
      {
        id: "child-assignee",
        email: "child@example.com",
        name: "Child assignee",
      },
    ])
    .returning();
  await db.insert(schema.workspaceUserTable).values(
    assignees.map((user) => ({
      userId: user.id,
      workspaceId: f.workspace.id,
      role: "member",
      joinedAt: new Date(),
    })),
  );
  await db
    .update(schema.taskTable)
    .set({ userId: "parent-assignee" })
    .where(eq(schema.taskTable.id, f.parent.id));
  await db
    .update(schema.taskTable)
    .set({ userId: "child-assignee" })
    .where(eq(schema.taskTable.id, f.child.id));
  await updateStatus({
    id: f.parent.id,
    status: "done",
    currentUserId: f.user.id,
  });
  await updateSubtasks(
    f.parent.id,
    "done",
    [f.child.id],
    f.user.id,
    f.workspace.id,
  );
  expect(publish).toHaveBeenCalledWith(
    "task.status_changed",
    expect.objectContaining({
      taskId: f.child.id,
      assigneeId: "child-assignee",
    }),
  );
  expect(await db.query.notificationTable.findMany()).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        userId: "parent-assignee",
        resourceId: f.child.id,
        type: "task_status_changed",
      }),
    ]),
  );
});

it("serves and applies the authenticated preview contract", async () => {
  const f = await fixture();
  await updateStatus({
    id: f.parent.id,
    status: "archived",
    currentUserId: f.user.id,
  });
  mockAuthenticatedSession(f.user);
  const { app } = createApp();
  const previewResponse = await app.request(
    `/api/task/subtask-status/${f.parent.id}?status=archived`,
  );
  expect(previewResponse.status).toBe(200);
  const preview = await previewResponse.json();
  expect(preview.subtasks).toHaveLength(2);
  const updateResponse = await app.request(
    `/api/task/subtask-status/${f.parent.id}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "archived",
        taskIds: preview.subtasks.map((task: { id: string }) => task.id),
      }),
    },
  );
  expect(updateResponse.status).toBe(200);
  expect(await updateResponse.json()).toMatchObject({
    success: true,
    updatedCount: 2,
  });
});
