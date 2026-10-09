import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const NOTIFICATION_PAGE_CAP = 50;

export const RawNotification = Schema.Struct({
  id: Schema.String,
  title: NullableString,
  content: NullableString,
  type: Schema.String,
  eventData: Schema.optionalKey(Schema.Unknown),
  isRead: Schema.NullOr(Schema.Boolean),
  resourceId: NullableString,
  resourceType: NullableString,
  createdAt: Schema.String,
});
export type RawNotification = typeof RawNotification.Type;

const NotificationList = Schema.Array(RawNotification);

const BulkResult = Schema.Struct({ success: Schema.Boolean });

const ReadNotification = Schema.Struct({ id: Schema.String });

export const NotificationTask = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  number: Schema.NullOr(Schema.Number),
  title: Schema.String,
});
export type NotificationTask = typeof NotificationTask.Type;

export const listNotifications = Effect.fnUntraced(function* (
  workspaceId: string | undefined,
) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/notification", NotificationList, {
    query: { workspaceId },
  });
});

export const markNotificationRead = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "PATCH",
    `/api/notification/${encodeURIComponent(id)}/read`,
    ReadNotification,
  );
});

export const markAllNotificationsRead = Effect.fnUntraced(function* (
  workspaceId: string | undefined,
) {
  const api = yield* KaneoApi;
  return yield* api.request("PATCH", "/api/notification/read-all", BulkResult, {
    query: { workspaceId },
  });
});

export const getNotificationTask = Effect.fnUntraced(function* (
  taskId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/task/${encodeURIComponent(taskId)}`,
    NotificationTask,
  );
});
