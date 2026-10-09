import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

const NullableString = Schema.NullOr(Schema.String);

export const ProjectRecord = Schema.Struct({
  id: Schema.String,
  workspaceId: Schema.String,
  slug: Schema.String,
  name: Schema.String,
  icon: NullableString,
  description: NullableString,
  isPublic: Schema.NullOr(Schema.Boolean),
  archivedAt: NullableString,
});
export type ProjectRecord = typeof ProjectRecord.Type;

export const ProjectStatistics = Schema.Struct({
  totalTasks: Schema.Number,
  completionPercentage: Schema.Number,
  dueDate: NullableString,
});
export type ProjectStatistics = typeof ProjectStatistics.Type;

export const ProjectRecordWithStatistics = Schema.Struct({
  ...ProjectRecord.fields,
  statistics: ProjectStatistics,
});
export type ProjectRecordWithStatistics =
  typeof ProjectRecordWithStatistics.Type;

const ProjectRecordList = Schema.Array(ProjectRecordWithStatistics);

export const MovedProject = Schema.Struct({
  ...ProjectRecord.fields,
  unassignedTaskCount: Schema.Number,
});
export type MovedProject = typeof MovedProject.Type;

export type ProjectUpdateBody = {
  readonly name: string;
  readonly icon: string;
  readonly slug: string;
  readonly description: string;
  readonly isPublic: boolean;
};

function projectPath(id: string, suffix = ""): string {
  return `/api/project/${encodeURIComponent(id)}${suffix}`;
}

export const listProjectRecords = Effect.fnUntraced(function* (
  workspaceId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", "/api/project", ProjectRecordList, {
    query: { workspaceId, includeArchived: "true" },
  });
});

export const getProjectRecord = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request("GET", projectPath(id), ProjectRecord);
});

export const createProject = Effect.fnUntraced(function* (body: {
  readonly workspaceId: string;
  readonly name: string;
  readonly slug: string;
  readonly icon: string;
}) {
  const api = yield* KaneoApi;
  return yield* api.request("POST", "/api/project", ProjectRecord, { body });
});

export const updateProject = Effect.fnUntraced(function* (
  id: string,
  body: ProjectUpdateBody,
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", projectPath(id), ProjectRecord, { body });
});

export const archiveProject = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", projectPath(id, "/archive"), ProjectRecord);
});

export const unarchiveProject = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "PUT",
    projectPath(id, "/unarchive"),
    ProjectRecord,
  );
});

export const deleteProject = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request("DELETE", projectPath(id), ProjectRecord);
});

export const moveProject = Effect.fnUntraced(function* (
  id: string,
  workspaceId: string,
) {
  const api = yield* KaneoApi;
  return yield* api.request("PUT", projectPath(id, "/move"), MovedProject, {
    body: { workspaceId },
  });
});
