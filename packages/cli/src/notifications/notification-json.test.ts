import { describe, expect, it } from "vite-plus/test";
import type { NotificationView } from "./normalize-notification.js";
import { toNotificationJson } from "./notification-json.js";

const view: NotificationView = {
  id: "n1",
  type: "task_assignee_changed",
  title: "Task assigned to you",
  message: "Fix login",
  read: false,
  createdAt: "2026-10-08T10:00:00.000Z",
  workspaceId: "ws_1",
  projectId: "p1",
  taskId: "t1",
  taskTitle: "Fix login",
};

describe("toNotificationJson", () => {
  it("adds the ticket id and link of the related task", () => {
    expect(
      toNotificationJson(
        view,
        {
          tasks: new Map([
            [
              "t1",
              {
                id: "t1",
                projectId: "p1",
                number: 12,
                title: "Fix login redirect",
              },
            ],
          ]),
          projectSlugs: new Map([["p1", "kan"]]),
        },
        "https://kaneo.test",
      ).task,
    ).toEqual({
      id: "t1",
      ticketId: "KAN-12",
      title: "Fix login redirect",
      url: "https://kaneo.test/dashboard/workspace/ws_1/project/p1/task/t1",
    });
  });

  it("keeps the task without a ticket id when it could not be loaded", () => {
    expect(
      toNotificationJson(
        view,
        { tasks: new Map(), projectSlugs: new Map() },
        "https://kaneo.test",
      ).task,
    ).toEqual({
      id: "t1",
      ticketId: null,
      title: "Fix login",
      url: "https://kaneo.test/dashboard/workspace/ws_1/project/p1/task/t1",
    });
  });

  it("has no task for workspace notifications", () => {
    expect(
      toNotificationJson(
        { ...view, taskId: null, taskTitle: null, projectId: null },
        { tasks: new Map(), projectSlugs: new Map() },
        "https://kaneo.test",
      ).task,
    ).toBeNull();
  });
});
