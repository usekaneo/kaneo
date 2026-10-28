import { Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import {
  listNotifications,
  NOTIFICATION_PAGE_CAP,
} from "../../api/notifications.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { Session } from "../../services/session.js";
import { lookupNotificationTasks } from "../../notifications/lookup-notification-tasks.js";
import { normalizeNotification } from "../../notifications/normalize-notification.js";
import { toNotificationJson } from "../../notifications/notification-json.js";
import { renderNotificationList } from "../../notifications/render-notification-list.js";
import { ApiLayer } from "../api-layer.js";

export const runNotificationList = Effect.fn("command.notification.list")(
  function* (options: { readonly unread: boolean; readonly limit: number }) {
    if (options.limit < 1) {
      return yield* new InvalidArgument({
        message: "--limit must be at least 1.",
      });
    }
    const session = yield* Session;
    const workspaceId = Option.getOrUndefined(session.workspace)?.id;
    const { raw, shown, lookup } = yield* withSpinner("Loading notifications")(
      Effect.gen(function* () {
        const raw = yield* listNotifications(workspaceId);
        const views = raw.map(normalizeNotification);
        const matching = options.unread
          ? views.filter((view) => !view.read)
          : views;
        const shown = matching.slice(0, options.limit);
        const lookup = yield* lookupNotificationTasks(shown);
        return { raw, shown, lookup, matching };
      }),
    );
    const notifications = shown.map((view) =>
      toNotificationJson(view, lookup, session.webUrl),
    );
    const matchingCount = options.unread
      ? raw.filter((item) => item.isRead !== true).length
      : raw.length;

    yield* emit(notifications, (ui) =>
      renderNotificationList(ui, {
        notifications,
        unreadOnly: options.unread,
        unreadCount: raw.filter((item) => item.isRead !== true).length,
        hidden: matchingCount - notifications.length,
        capped: raw.length >= NOTIFICATION_PAGE_CAP,
        now: new Date(),
      }),
    );
  },
);

export const notificationList = Command.make(
  "list",
  {
    unread: Flag.Boolean("unread").pipe(
      Flag.withAlias("u"),
      Flag.withDescription("Only unread notifications"),
      Flag.withDefault(false),
    ),
    limit: Flag.Int("limit").pipe(
      Flag.withAlias("L"),
      Flag.withDescription(
        `Maximum number to show (the server keeps the latest ${NOTIFICATION_PAGE_CAP})`,
      ),
      Flag.withDefault(20),
    ),
  },
  (options) => runNotificationList(options),
).pipe(
  Command.withDescription(
    "List your latest notifications, in the selected workspace if there is one",
  ),
  Command.provide(ApiLayer),
);
