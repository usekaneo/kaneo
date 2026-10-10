import { Effect, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../../api/notifications.js";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { Output } from "../../output/output.js";
import { withSpinner } from "../../output/spinner.js";
import { pick } from "../../prompts/pick.js";
import { matchNotificationId } from "../../notifications/match-notification.js";
import { normalizeNotification } from "../../notifications/normalize-notification.js";
import { relativeTime } from "../../notifications/relative-time.js";
import { renderNotificationsRead } from "../../notifications/render-notifications-read.js";
import { Session } from "../../services/session.js";
import { ApiLayer } from "../api-layer.js";

const markAll = Effect.fnUntraced(function* () {
  const session = yield* Session;
  const workspaceId = Option.getOrUndefined(session.workspace)?.id ?? null;
  yield* withSpinner("Marking all notifications read")(
    markAllNotificationsRead(workspaceId ?? undefined),
  );
  yield* emit({ all: true, ids: [] as string[], workspaceId }, (ui) =>
    renderNotificationsRead(ui, { all: true, count: 0 }),
  );
});

const chooseUnread = Effect.fnUntraced(function* () {
  const session = yield* Session;
  const raw = yield* withSpinner("Loading notifications")(
    listNotifications(Option.getOrUndefined(session.workspace)?.id),
  );
  const unread = raw.map(normalizeNotification).filter((view) => !view.read);
  if (unread.length === 0) {
    return yield* new InvalidArgument({
      message: "You have no unread notifications.",
    });
  }
  const now = new Date();
  const id = yield* pick(
    "Mark which notification read",
    unread.map((view) => ({
      title: view.message ? `${view.title}: ${view.message}` : view.title,
      value: view.id,
      description: relativeTime(view.createdAt, now),
    })),
  );
  return [id];
});

export const runNotificationRead = Effect.fn("command.notification.read")(
  function* (options: {
    readonly ids: ReadonlyArray<string>;
    readonly all: boolean;
  }) {
    if (options.all && options.ids.length > 0) {
      return yield* new InvalidArgument({
        message: "Pass notification ids or --all, not both.",
      });
    }
    if (options.all) return yield* markAll();
    const output = yield* Output;
    let ids: ReadonlyArray<string>;
    if (options.ids.length > 0) {
      const known = yield* withSpinner("Loading notifications")(
        listNotifications(undefined),
      );
      ids = yield* Effect.forEach(options.ids, (reference) =>
        Effect.fromResult(
          matchNotificationId(
            known.map((item) => item.id),
            reference,
          ),
        ),
      );
    } else if (output.interactive) {
      ids = yield* chooseUnread();
    } else {
      return yield* new InvalidArgument({
        message: "Which notifications should be marked read?",
        hint: "Pass ids from kaneo notification list, or --all.",
      });
    }
    const unique = [...new Set(ids)];
    yield* withSpinner("Marking notifications read")(
      Effect.forEach(unique, (id) => markNotificationRead(id), {
        concurrency: 4,
        discard: true,
      }),
    );
    yield* emit({ all: false, ids: unique, workspaceId: null }, (ui) =>
      renderNotificationsRead(ui, { all: false, count: unique.length }),
    );
  },
);

export const notificationRead = Command.make(
  "read",
  {
    ids: Argument.String("id").pipe(
      Argument.withDescription(
        "Notification ids or the short ids from kaneo notification list",
      ),
      Argument.variadic(),
    ),
    all: Flag.Boolean("all").pipe(
      Flag.withAlias("a"),
      Flag.withDescription(
        "Mark every notification read, in the selected workspace if there is one",
      ),
      Flag.withDefault(false),
    ),
  },
  (options) => runNotificationRead(options),
).pipe(
  Command.withDescription("Mark notifications as read"),
  Command.provide(ApiLayer),
);
