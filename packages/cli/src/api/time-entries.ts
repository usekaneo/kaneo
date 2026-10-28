import { Effect, Schema } from "effect";
import { NotFound } from "../errors/errors.js";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const TimeEntry = Schema.Struct({
  id: Schema.String,
  taskId: Schema.String,
  userId: NullableString,
  description: NullableString,
  startTime: Schema.String,
  endTime: NullableString,
  duration: Schema.NullOr(Schema.Number),
});
export type TimeEntry = typeof TimeEntry.Type;

export const TimeEntryWithUser = Schema.Struct({
  ...TimeEntry.fields,
  userName: NullableString,
});
export type TimeEntryWithUser = typeof TimeEntryWithUser.Type;

const TimeEntryList = Schema.Array(TimeEntryWithUser);

export type CreateTimeEntryBody = {
  readonly taskId: string;
  readonly startTime: string;
  readonly endTime?: string;
  readonly description?: string;
};

export type UpdateTimeEntryBody = {
  readonly startTime: string;
  readonly endTime?: string;
  readonly description?: string;
};

function entryPath(id: string): string {
  return `/api/time-entry/${encodeURIComponent(id)}`;
}

export const listTimeEntries = Effect.fnUntraced(function* (taskId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/time-entry/task/${encodeURIComponent(taskId)}`,
    TimeEntryList,
  );
});

export const getTimeEntry = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  const notFound = () =>
    new NotFound({ message: `Time entry ${id} not found.` });
  return yield* api.request("GET", entryPath(id), TimeEntry).pipe(
    Effect.catchTags({
      NotFound: () => Effect.fail(notFound()),
      InvalidRequest: (error) =>
        /could not be determined/i.test(error.message)
          ? Effect.fail(notFound())
          : Effect.fail(error),
    }),
  );
});

export const createTimeEntry = Effect.fnUntraced(function* (
  body: CreateTimeEntryBody,
) {
  const api = yield* KaneoApi;
  return yield* api.request("POST", "/api/time-entry", TimeEntry, { body });
});

export const updateTimeEntry = Effect.fnUntraced(function* (
  id: string,
  body: UpdateTimeEntryBody,
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", entryPath(id), TimeEntry, { body });
});
