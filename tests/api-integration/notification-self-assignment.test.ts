import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import "../../apps/api/src/notification";
import db, { schema } from "../../apps/api/src/database";
import updateTaskAssignee from "../../apps/api/src/task/controllers/update-task-assignee";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("../../apps/api/src/events", async (original) => {
  const events = await original<typeof import("../../apps/api/src/events")>();
  return {
    ...events,
    // Assertions must wait for the notification subscriber to finish.
    publishEvent: (...args: Parameters<typeof events.publishEvent>) =>
      events.publishEvent(args[0], args[1], { waitForHandlers: true }),
  };
});

beforeEach(resetTestDatabase);

async function fixture() {
  const actor = await createWorkspaceMember();
  const teammate = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: actor.workspace.id,
    userId: teammate.user.id,
    joinedAt: new Date(),
  });
  const { project } = await createProjectFixture({
    workspaceId: actor.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({ projectId: project.id, title: "Assigned task", status: "to-do" })
    .returning();
  return { actor, teammate, task };
}

const assignmentNotifications = (userId: string) =>
  db
    .select()
    .from(schema.notificationTable)
    .where(eq(schema.notificationTable.userId, userId));

describe("task assignment notifications", () => {
  it("does not notify a user who assigns the task to themselves", async () => {
    const { actor, task } = await fixture();

    await updateTaskAssignee({
      id: task.id,
      userId: actor.user.id,
      currentUserId: actor.user.id,
    });

    expect(await assignmentNotifications(actor.user.id)).toEqual([]);
  });

  it("notifies the assignee when another user assigns them", async () => {
    const { actor, teammate, task } = await fixture();

    await updateTaskAssignee({
      id: task.id,
      userId: teammate.user.id,
      currentUserId: actor.user.id,
    });

    expect(await assignmentNotifications(teammate.user.id)).toEqual([
      expect.objectContaining({
        type: "task_assignee_changed",
        resourceId: task.id,
        resourceType: "task",
      }),
    ]);
    expect(await assignmentNotifications(actor.user.id)).toEqual([]);
  });
});
