import { NOTIFICATION_PAGE_CAP } from "../api/notifications.js";
import { type Cell, text } from "../render/cell.js";
import { renderTable } from "../render/table.js";
import type { Ui } from "../render/ui.js";
import type { NotificationJson } from "./notification-json.js";
import { relativeTime } from "./relative-time.js";

export const SHORT_ID_LENGTH = 8;

export type NotificationListView = {
  readonly notifications: ReadonlyArray<NotificationJson>;
  readonly unreadOnly: boolean;
  readonly unreadCount: number;
  readonly hidden: number;
  readonly capped: boolean;
  readonly now: Date;
};

export function renderNotificationList(
  ui: Ui,
  view: NotificationListView,
): string[] {
  const { theme, glyphs } = ui;
  const latest = `the latest ${NOTIFICATION_PAGE_CAP}`;
  if (view.notifications.length === 0) {
    const empty = view.unreadOnly
      ? "No unread notifications"
      : "No notifications";
    return [
      "",
      `  ${theme.muted(glyphs.dot)} ${empty}${view.capped ? ` in ${latest}` : ""}.`,
      "",
    ];
  }
  const rows = renderTable(
    ui,
    view.notifications,
    [
      {
        header: "",
        cell: (item): Cell => [
          item.read ? text(" ") : text(glyphs.dot, theme.info),
        ],
      },
      {
        header: "When",
        cell: (item): Cell => [
          text(relativeTime(item.createdAt, view.now), theme.muted),
        ],
      },
      {
        header: "Task",
        optional: true,
        cell: (item): Cell =>
          item.task?.ticketId
            ? [
                text(
                  item.task.ticketId,
                  theme.muted,
                  item.task.url ?? undefined,
                ),
              ]
            : [],
      },
      {
        header: "Notification",
        flex: true,
        minWidth: 16,
        cell: (item): Cell => [
          text(item.title, item.read ? undefined : theme.strong),
          ...(item.message
            ? [text(` ${glyphs.separator} ${item.message}`, theme.muted)]
            : []),
        ],
      },
      {
        header: "ID",
        cell: (item): Cell => [
          text(item.id.slice(0, SHORT_ID_LENGTH), theme.muted),
        ],
      },
    ],
    { width: ui.caps.columns, indent: 2 },
  );
  const summary = [
    `${view.unreadCount} unread`,
    ...(view.capped ? [`showing ${latest}`] : []),
  ].join(` ${glyphs.separator} `);
  const lines = ["", ...rows, "", `  ${theme.muted(summary)}`];
  if (view.hidden > 0) {
    lines.push(
      `  ${theme.muted(`${view.hidden} more. Pass --limit to see them.`)}`,
    );
  }
  if (view.unreadCount > 0) {
    lines.push(
      `  ${theme.muted("Mark them read with")} ${theme.strong("kaneo notification read <id>")} ${theme.muted("or")} ${theme.strong("--all")}`,
    );
  }
  lines.push("");
  return lines;
}
