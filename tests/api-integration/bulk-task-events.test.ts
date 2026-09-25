import { beforeEach, describe, expect, it, vi } from "vitest";
import db, { schema } from "../../apps/api/src/database";
import bulkUpdateTasks from "../../apps/api/src/task/controllers/bulk-update-tasks";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

const publish = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../../apps/api/src/events", () => ({ publishEvent: publish }));

beforeEach(async () => {
  await resetTestDatabase();
  vi.clearAllMocks();
});

describe("bulk task event snapshots", () => {
  it("preserves each task's old status, title and assignee for reopening and notifications", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const tasks = await db
      .insert(schema.taskTable)
      .values([
        {
          projectId: project.id,
          title: "Completed",
          status: "done",
          userId: user.id,
          number: 1,
        },
        { projectId: project.id, title: "Queued", status: "to-do", number: 2 },
      ])
      .returning();
    await bulkUpdateTasks({
      taskIds: tasks.map((task) => task.id),
      operation: "updateStatus",
      value: "in-progress",
      userId: user.id,
    });
    for (const task of tasks) {
      expect(publish).toHaveBeenCalledWith(
        "task.status_changed",
        expect.objectContaining({
          taskId: task.id,
          projectId: project.id,
          oldStatus: task.status,
          newStatus: "in-progress",
          title: task.title,
          assigneeId: task.userId,
        }),
      );
    }
    expect(await db.query.taskTable.findMany()).toEqual(
      expect.arrayContaining(
        tasks.map((task) =>
          expect.objectContaining({ id: task.id, status: "in-progress" }),
        ),
      ),
    );
  });

  it("preserves differing old priorities and titles in a single bulk operation", async () => {
    const { user, workspace } = await createWorkspaceMember();
    const { project } = await createProjectFixture({
      workspaceId: workspace.id,
    });
    const tasks = await db
      .insert(schema.taskTable)
      .values([
        { projectId: project.id, title: "Low", priority: "low", number: 1 },
        { projectId: project.id, title: "High", priority: "high", number: 2 },
      ])
      .returning();
    await bulkUpdateTasks({
      taskIds: tasks.map((task) => task.id),
      operation: "updatePriority",
      value: "medium",
      userId: user.id,
    });
    for (const task of tasks) {
      expect(publish).toHaveBeenCalledWith(
        "task.priority_changed",
        expect.objectContaining({
          taskId: task.id,
          oldPriority: task.priority,
          newPriority: "medium",
          title: task.title,
        }),
      );
    }
  });
});
