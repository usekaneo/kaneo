import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import { publishEvent } from "../../apps/api/src/events";
import { createApp } from "../../apps/api/src/index";
import { mockAuthenticatedSession } from "./helpers/auth";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", async (original) => ({
  ...(await original<object>()),
  publishEvent: vi.fn(async () => undefined),
}));
beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});
async function setup() {
  const member = await createWorkspaceMember();
  const { project, columns } = await createProjectFixture({
    workspaceId: member.workspace.id,
  });
  mockAuthenticatedSession(member.user);
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      columnId: columns.todo.id,
      title: "Original",
      description: "Old body",
      priority: "medium",
      status: "to-do",
      number: 1,
      position: 1,
    })
    .returning();
  const { app } = createApp();
  const update = (values: Record<string, unknown>) =>
    app.request(`/api/task/${task.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: task.title,
        status: task.status,
        priority: task.priority,
        projectId: project.id,
        position: task.position,
        ...values,
      }),
    });
  return { task, update, project, user: member.user };
}

describe("general task update integration events", () => {
  it("publishes changed fields with full descriptions and preserves the realtime refresh", async () => {
    const { task, update, project, user } = await setup();
    const description = "New body ".repeat(2000);
    const response = await update({
      title: "Updated",
      description,
      priority: "high",
      status: "done",
    });
    expect(response.status).toBe(200);
    const common = { taskId: task.id, projectId: project.id, userId: user.id };
    expect(publishEvent).toHaveBeenCalledWith(
      "task.title_changed",
      expect.objectContaining({
        ...common,
        oldTitle: "Original",
        newTitle: "Updated",
      }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      "task.description_changed",
      expect.objectContaining({
        ...common,
        oldDescription: "Old body",
        newDescription: description,
      }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      "task.priority_changed",
      expect.objectContaining({
        ...common,
        oldPriority: "medium",
        newPriority: "high",
      }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      "task.status_changed",
      expect.objectContaining({
        ...common,
        oldStatus: "to-do",
        newStatus: "done",
      }),
    );
    expect(publishEvent).toHaveBeenCalledWith(
      "task.updated",
      expect.objectContaining(common),
    );
    expect(
      await db.query.taskTable.findFirst({
        where: eq(schema.taskTable.id, task.id),
      }),
    ).toMatchObject({ title: "Updated", description, priority: "high" });
  });
  it.each([{}, { description: "Old body" }])(
    "does not emit field changes for omitted or unchanged fields: %j",
    async (values) => {
      const { update } = await setup();
      expect((await update(values)).status).toBe(200);
      expect(vi.mocked(publishEvent).mock.calls.map(([name]) => name)).toEqual([
        "task.updated",
      ]);
    },
  );
  it("emits an explicit description clear", async () => {
    const { update } = await setup();
    expect((await update({ description: "" })).status).toBe(200);
    expect(publishEvent).toHaveBeenCalledWith(
      "task.description_changed",
      expect.objectContaining({
        oldDescription: "Old body",
        newDescription: "",
      }),
    );
  });
  it("does not publish changes for rejected updates", async () => {
    const { update } = await setup();
    expect((await update({ title: "Invalid", position: -1 })).status).toBe(400);
    expect(publishEvent).not.toHaveBeenCalled();
  });
});
