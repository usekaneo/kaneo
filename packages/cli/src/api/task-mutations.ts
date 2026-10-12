import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const CreatedTask = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  number: Schema.NullOr(Schema.Number),
  title: Schema.String,
  description: NullableString,
  status: Schema.String,
  priority: Schema.String,
  startDate: NullableString,
  dueDate: NullableString,
  createdAt: Schema.String,
  userId: NullableString,
});
export type CreatedTask = typeof CreatedTask.Type;

const UpdatedTask = Schema.Struct({ id: Schema.String });

const EditableTask = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  title: Schema.String,
  status: Schema.String,
  priority: Schema.String,
  position: Schema.NullOr(Schema.Number),
  userId: NullableString,
  dueDate: NullableString,
});

export type Priority = "no-priority" | "low" | "medium" | "high" | "urgent";

export type CreateTaskBody = {
  readonly title: string;
  readonly description: string;
  readonly priority: Priority;
  readonly status: string;
  readonly userId?: string;
  readonly dueDate?: string;
  readonly startDate?: string;
};

function taskPath(route: string, id: string): string {
  return `/api/task/${route}/${encodeURIComponent(id)}`;
}

export const createTask = Effect.fnUntraced(function* (
  projectId: string,
  body: CreateTaskBody,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    `/api/task/${encodeURIComponent(projectId)}`,
    CreatedTask,
    {
      body,
    },
  );
});

export const updateTaskTitle = Effect.fnUntraced(function* (
  id: string,
  title: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", taskPath("title", id), UpdatedTask, {
    body: { title },
  });
});

export const updateTaskDescription = Effect.fnUntraced(function* (
  id: string,
  description: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", taskPath("description", id), UpdatedTask, {
    body: { description },
  });
});

export const updateTaskPriority = Effect.fnUntraced(function* (
  id: string,
  priority: Priority,
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", taskPath("priority", id), UpdatedTask, {
    body: { priority },
  });
});

export const updateTaskDueDate = Effect.fnUntraced(function* (
  id: string,
  dueDate: string | null,
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", taskPath("due-date", id), UpdatedTask, {
    body: dueDate === null ? {} : { dueDate },
  });
});

export const updateTaskStartDate = Effect.fnUntraced(function* (
  id: string,
  startDate: string | null,
) {
  const api = yield* KaneoApi;
  const path = `/api/task/${encodeURIComponent(id)}`;
  const current = yield* api.request("GET", path, EditableTask, {
    query: { view: "detail" },
  });
  return yield* api.request("PUT", path, UpdatedTask, {
    body: {
      title: current.title,
      status: current.status,
      priority: current.priority || "no-priority",
      projectId: current.projectId,
      position: current.position ?? 0,
      ...(current.userId ? { userId: current.userId } : {}),
      ...(current.dueDate ? { dueDate: current.dueDate } : {}),
      ...(startDate ? { startDate } : {}),
    },
  });
});

export const deleteTask = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "DELETE",
    `/api/task/${encodeURIComponent(id)}`,
    UpdatedTask,
  );
});
