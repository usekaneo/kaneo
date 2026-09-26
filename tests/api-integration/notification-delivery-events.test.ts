import * as email from "@kaneo/email";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "../../apps/api/src/notification";
import createComment from "../../apps/api/src/activity/controllers/create-comment";
import db, { schema } from "../../apps/api/src/database";
import { encryptSecret } from "../../apps/api/src/notification-preferences/secrets";
import updateTaskStatus from "../../apps/api/src/task/controllers/update-task-status";
import { sendOutboundRequest } from "../../apps/api/src/utils/outbound-request";
import { resetTestDatabase } from "./helpers/database";
import {
  createProjectFixture,
  createWorkspaceMember,
} from "./helpers/fixtures";

vi.mock("@kaneo/email", async (original) => ({
  ...(await original<object>()),
  sendNotificationEmail: vi.fn(async () => undefined),
}));

vi.mock("../../apps/api/src/utils/outbound-request", async (original) => ({
  ...(await original<object>()),
  sendOutboundRequest: vi.fn(async () => new Response(null, { status: 200 })),
}));

vi.mock("../../apps/api/src/events", async (original) => {
  const events = await original<typeof import("../../apps/api/src/events")>();
  return {
    ...events,
    // Delivery assertions and the next test's TRUNCATE must wait for every
    // subscriber, including work that continues after the mocked HTTP send.
    publishEvent: (...args: Parameters<typeof events.publishEvent>) =>
      events.publishEvent(args[0], args[1], { waitForHandlers: true }),
  };
});

afterEach(() => vi.unstubAllEnvs());
beforeEach(async () => {
  vi.stubEnv("NOTIFICATION_SECRET_ENCRYPTION_KEY", "notification-test-key");
  await resetTestDatabase();
  vi.clearAllMocks();
});
async function fixture(separateAssignee = false) {
  const actor = await createWorkspaceMember();
  const recipient = await createWorkspaceMember();
  await db.insert(schema.workspaceUserTable).values({
    workspaceId: actor.workspace.id,
    userId: recipient.user.id,
    joinedAt: new Date(),
  });
  const assignee = separateAssignee ? await createWorkspaceMember() : recipient;
  if (separateAssignee) {
    await db.insert(schema.workspaceUserTable).values({
      workspaceId: actor.workspace.id,
      userId: assignee.user.id,
      joinedAt: new Date(),
    });
  }
  const { project } = await createProjectFixture({
    workspaceId: actor.workspace.id,
  });
  const [task] = await db
    .insert(schema.taskTable)
    .values({
      projectId: project.id,
      title: "Notified task",
      userId: assignee.user.id,
      status: "to-do",
    })
    .returning();
  await db.insert(schema.userNotificationPreferenceTable).values({
    userId: recipient.user.id,
    emailEnabled: true,
    gotifyEnabled: true,
    gotifyServerUrl: "https://gotify.example",
    gotifyToken: encryptSecret("gotify-test-token"),
    taskCommentEnabled: true,
    taskStatusChangeEnabled: true,
  });
  await db.insert(schema.userNotificationWorkspaceRuleTable).values({
    userId: recipient.user.id,
    workspaceId: actor.workspace.id,
    isActive: true,
    emailEnabled: true,
    projectMode: "all",
    gotifyEnabled: true,
  });
  const send = vi
    .spyOn(email, "sendNotificationEmail")
    .mockResolvedValue(undefined);
  return { actor, recipient, assignee, task, send };
}
describe("status, comment and mention delivery", () => {
  it.each(["status", "comment", "mention"] as const)(
    "delivers %s notifications through the event, email and Gotify paths",
    async (kind) => {
      const { actor, recipient, assignee, task, send } = await fixture(
        kind === "mention",
      );
      if (kind === "status") {
        await updateTaskStatus({
          id: task.id,
          status: "in-progress",
          currentUserId: actor.user.id,
        });
      } else {
        await createComment(
          task.id,
          actor.user.id,
          kind === "mention"
            ? `<kaneo-mention id="${recipient.user.id}" label="Recipient"></kaneo-mention> please review`
            : "Please review",
        );
      }
      await vi.waitFor(() => expect(send).toHaveBeenCalledTimes(1));
      expect(send.mock.calls[0][0]).toBe(recipient.user.email);
      await vi.waitFor(() =>
        expect(sendOutboundRequest).toHaveBeenCalledTimes(1),
      );
      expect(vi.mocked(sendOutboundRequest).mock.calls[0][0]).toContain(
        "https://gotify.example/message",
      );
      const notifications = await db.select().from(schema.notificationTable);
      expect(notifications).toHaveLength(kind === "mention" ? 2 : 1);
      expect(notifications).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            userId: recipient.user.id,
            type: kind === "status" ? "task_status_changed" : `task_${kind}`,
          }),
        ]),
      );
      if (kind === "mention") {
        expect(notifications).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              userId: assignee.user.id,
              type: "task_comment",
            }),
          ]),
        );
      }
    },
  );
  it("suppresses an assignee's own status changes, comments and mentions", async () => {
    const { recipient, task, send } = await fixture();
    await updateTaskStatus({
      id: task.id,
      status: "in-progress",
      currentUserId: recipient.user.id,
    });
    await createComment(task.id, recipient.user.id, "My own comment");
    await createComment(
      task.id,
      recipient.user.id,
      `<kaneo-mention id="${recipient.user.id}">Me</kaneo-mention>`,
    );
    expect(await db.select().from(schema.notificationTable)).toEqual([]);
    expect(send).not.toHaveBeenCalled();
    expect(sendOutboundRequest).not.toHaveBeenCalled();
  });
});
