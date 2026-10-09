import { describe, expect, it } from "vite-plus/test";
import type { RawNotification } from "../api/notifications.js";
import { normalizeNotification } from "./normalize-notification.js";

function raw(overrides: Partial<RawNotification> = {}): RawNotification {
  return {
    id: "n1",
    title: null,
    content: null,
    type: "task_assignee_changed",
    eventData: {
      taskTitle: "Fix login redirect",
      projectId: "p1",
      workspaceId: "ws_1",
    },
    isRead: false,
    resourceId: "t1",
    resourceType: "task",
    createdAt: "2026-10-08T10:00:00.000Z",
    ...overrides,
  };
}

describe("normalizeNotification", () => {
  it("writes generated notifications from their type and event data", () => {
    expect(normalizeNotification(raw())).toEqual({
      id: "n1",
      type: "task_assignee_changed",
      title: "Task assigned to you",
      message: "Fix login redirect",
      read: false,
      createdAt: "2026-10-08T10:00:00.000Z",
      workspaceId: "ws_1",
      projectId: "p1",
      taskId: "t1",
      taskTitle: "Fix login redirect",
    });
  });

  it("describes status changes with readable column names", () => {
    const view = normalizeNotification(
      raw({
        type: "task_status_changed",
        eventData: {
          taskTitle: "Ship it",
          oldStatus: "in-progress",
          newStatus: "done",
        },
      }),
    );
    expect(view.title).toBe("Task status changed");
    expect(view.message).toBe('"Ship it" moved from In progress to Done');
  });

  it("names the person behind mentions and comments", () => {
    expect(
      normalizeNotification(
        raw({
          type: "task_comment",
          eventData: {
            taskTitle: "Ship it",
            commenterName: "Grace",
            commentPreview: "Looks good,\nmerging",
          },
        }),
      ),
    ).toMatchObject({
      title: "Grace commented on your task",
      message: "Ship it: Looks good, merging",
    });
    expect(
      normalizeNotification(
        raw({ type: "task_mention", eventData: { taskTitle: "Ship it" } }),
      ).title,
    ).toBe("Someone mentioned you");
  });

  it("formats reminder lead times", () => {
    expect(
      normalizeNotification(
        raw({
          type: "due_date_reminder",
          eventData: { taskTitle: "Ship it", leadTimeMinutes: 120 },
        }),
      ).message,
    ).toBe("Ship it is due in 2 hours");
  });

  it("falls back to the stored title and content", () => {
    expect(
      normalizeNotification(
        raw({
          type: "info",
          title: "Heads up",
          content: "Maintenance tonight",
          eventData: null,
          isRead: null,
          resourceId: null,
          resourceType: null,
        }),
      ),
    ).toEqual({
      id: "n1",
      type: "info",
      title: "Heads up",
      message: "Maintenance tonight",
      read: false,
      createdAt: "2026-10-08T10:00:00.000Z",
      workspaceId: null,
      projectId: null,
      taskId: null,
      taskTitle: null,
    });
  });

  it("names unknown types when there is no title", () => {
    expect(
      normalizeNotification(
        raw({ type: "custom_event", eventData: undefined, resourceType: null }),
      ).title,
    ).toBe("Custom event");
  });

  it("points workspace notifications at their workspace", () => {
    expect(
      normalizeNotification(
        raw({
          type: "workspace_created",
          eventData: { workspaceName: "Acme Studio" },
          resourceId: "ws_9",
          resourceType: "workspace",
        }),
      ),
    ).toMatchObject({
      workspaceId: "ws_9",
      taskId: null,
      message: 'Your workspace "Acme Studio" has been created',
    });
  });
});
