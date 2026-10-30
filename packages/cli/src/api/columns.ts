import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const ColumnDetail = Schema.Struct({
  id: Schema.String,
  projectId: Schema.String,
  name: Schema.String,
  slug: Schema.String,
  position: Schema.Number,
  icon: NullableString,
  color: NullableString,
  isFinal: Schema.Boolean,
});
export type ColumnDetail = typeof ColumnDetail.Type;

const ColumnDetailList = Schema.Array(ColumnDetail);

const BoardCount = Schema.Struct({
  pagination: Schema.Struct({ total: Schema.Number }),
});

const ColumnTaskPage = Schema.Struct({
  data: Schema.Struct({
    columns: Schema.Array(
      Schema.Struct({
        slug: Schema.String,
        tasks: Schema.Array(Schema.Struct({ id: Schema.String })),
      }),
    ),
  }),
  pagination: Schema.Struct({ totalPages: Schema.Number }),
});

export type CreateColumnBody = {
  readonly name: string;
  readonly icon?: string;
  readonly color?: string;
  readonly isFinal?: boolean;
};

export type UpdateColumnBody = {
  readonly name?: string;
  readonly icon?: string | null;
  readonly color?: string | null;
  readonly isFinal?: boolean;
};

const TASK_PAGE_SIZE = 100;

export const listColumnDetails = Effect.fnUntraced(function* (
  projectId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/column/${encodeURIComponent(projectId)}`,
    ColumnDetailList,
  );
});

export const countColumnTasks = Effect.fnUntraced(function* (
  projectId: string,
  slug: string,
) {
  const api = yield* KaneoApi;
  const page = yield* api.request(
    "GET",
    `/api/task/tasks/${encodeURIComponent(projectId)}`,
    BoardCount,
    { query: { status: slug, limit: 1 } },
  );
  return page.pagination.total;
});

export const listColumnTaskIds = Effect.fnUntraced(function* (
  projectId: string,
  slug: string,
) {
  const api = yield* KaneoApi;
  const ids: string[] = [];
  let page = 1;
  let totalPages = 1;
  while (page <= totalPages) {
    const response = yield* api.request(
      "GET",
      `/api/task/tasks/${encodeURIComponent(projectId)}`,
      ColumnTaskPage,
      { query: { status: slug, limit: TASK_PAGE_SIZE, page } },
    );
    for (const column of response.data.columns) {
      if (column.slug === slug) ids.push(...column.tasks.map((t) => t.id));
    }
    totalPages = response.pagination.totalPages;
    page += 1;
  }
  return ids;
});

export const createColumn = Effect.fnUntraced(function* (
  projectId: string,
  body: CreateColumnBody,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "POST",
    `/api/column/${encodeURIComponent(projectId)}`,
    ColumnDetail,
    { body },
  );
});

export const updateColumn = Effect.fnUntraced(function* (
  id: string,
  body: UpdateColumnBody,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "PUT",
    `/api/column/${encodeURIComponent(id)}`,
    ColumnDetail,
    { body },
  );
});

export const reorderColumns = Effect.fnUntraced(function* (
  projectId: string,
  columns: ReadonlyArray<{ readonly id: string; readonly position: number }>,
) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "PUT",
    `/api/column/reorder/${encodeURIComponent(projectId)}`,
    ColumnDetailList,
    { body: { columns } },
  );
});

export const deleteColumn = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "DELETE",
    `/api/column/${encodeURIComponent(id)}`,
    ColumnDetail,
  );
});
