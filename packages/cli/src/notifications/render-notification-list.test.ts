import { describe, expect, it } from "vite-plus/test";
import { makeUi } from "../render/ui.js";
import { stringWidth } from "../render/width.js";
import type { NotificationJson } from "./notification-json.js";
import { renderNotificationList } from "./render-notification-list.js";

const ui = (columns: number) =>
  makeUi({
    color: 0,
    unicode: true,
    hyperlinks: false,
    animate: false,
    columns,
  });

const now = new Date(2026, 9, 8, 12, 0);

const item = (
  id: string,
  minutesAgo: number,
  read: boolean,
  ticketId: string | null,
  title: string,
  message: string | null,
): NotificationJson => ({
  id,
  type: "task_assignee_changed",
  title,
  message,
  read,
  createdAt: new Date(now.getTime() - minutesAgo * 60 * 1000).toISOString(),
  workspaceId: "ws_1",
  task: ticketId
    ? { id: "t1", ticketId, title: message, url: "https://kaneo.test/t1" }
    : null,
});

const notifications = [
  item(
    "abcd1234efgh5678ijkl9012",
    5,
    false,
    "KAN-12",
    "Task assigned to you",
    "Fix login redirect after device sign in",
  ),
  item(
    "zyxw1234efgh5678ijkl9012",
    26 * 60,
    true,
    "KAN-3",
    "Task status changed",
    '"Add shortcuts" moved from To do to In progress',
  ),
  item(
    "qrst1234efgh5678ijkl9012",
    3 * 24 * 60,
    true,
    null,
    "Workspace created",
    null,
  ),
];

describe("renderNotificationList", () => {
  it("marks unread rows and fits 80 columns", () => {
    expect(
      renderNotificationList(ui(80), {
        notifications,
        unreadOnly: false,
        unreadCount: 1,
        hidden: 0,
        capped: false,
        now,
      }),
    ).toEqual([
      "",
      "  ●  5m ago  KAN-12  Task assigned to you · Fix login redirect after…   abcd1234",
      '     1d ago  KAN-3   Task status changed · "Add shortcuts" moved from…  zyxw1234',
      "     3d ago          Workspace created                                  qrst1234",
      "",
      "  1 unread",
      "  Mark them read with kaneo notification read <id> or --all",
      "",
    ]);
  });

  it("says when the list is capped or trimmed", () => {
    const lines = renderNotificationList(ui(80), {
      notifications: notifications.slice(1),
      unreadOnly: false,
      unreadCount: 0,
      hidden: 4,
      capped: true,
      now,
    });
    expect(lines.slice(-3)).toEqual([
      "  0 unread · showing the latest 50",
      "  4 more. Pass --limit to see them.",
      "",
    ]);
  });

  it("stays inside narrow terminals", () => {
    for (const line of renderNotificationList(ui(50), {
      notifications,
      unreadOnly: false,
      unreadCount: 1,
      hidden: 0,
      capped: false,
      now,
    }).slice(0, 4)) {
      expect(stringWidth(line)).toBeLessThanOrEqual(50);
    }
  });

  it("explains an empty unread list", () => {
    expect(
      renderNotificationList(ui(80), {
        notifications: [],
        unreadOnly: true,
        unreadCount: 0,
        hidden: 0,
        capped: true,
        now,
      }),
    ).toEqual(["", "  ● No unread notifications in the latest 50.", ""]);
  });
});
