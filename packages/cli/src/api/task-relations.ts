import { Effect, Schema } from "effect";
import { KaneoApi } from "./kaneo-api.js";

export const API_RELATION_TYPES = ["subtask", "blocks", "related"] as const;
export type ApiRelationType = (typeof API_RELATION_TYPES)[number];

export const RelatedTask = Schema.Struct({
  id: Schema.String,
  title: Schema.String,
  status: Schema.String,
  isCompleted: Schema.Boolean,
  number: Schema.NullOr(Schema.Number),
  projectId: Schema.String,
});
export type RelatedTask = typeof RelatedTask.Type;

export const TaskRelation = Schema.Struct({
  id: Schema.String,
  sourceTaskId: Schema.String,
  targetTaskId: Schema.String,
  relationType: Schema.String,
});
export type TaskRelation = typeof TaskRelation.Type;

export const TaskRelationWithTasks = Schema.Struct({
  id: Schema.String,
  sourceTaskId: Schema.String,
  targetTaskId: Schema.String,
  relationType: Schema.String,
  sourceTask: Schema.NullOr(RelatedTask),
  targetTask: Schema.NullOr(RelatedTask),
});
export type TaskRelationWithTasks = typeof TaskRelationWithTasks.Type;

export const TaskRelationList = Schema.Array(TaskRelationWithTasks);

export type NewTaskRelation = {
  readonly sourceTaskId: string;
  readonly targetTaskId: string;
  readonly relationType: ApiRelationType;
};

export const listTaskRelations = Effect.fnUntraced(function* (taskId: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "GET",
    `/api/task-relation/${encodeURIComponent(taskId)}`,
    TaskRelationList,
  );
});

export const createTaskRelation = Effect.fnUntraced(function* (
  relation: NewTaskRelation,
) {
  const api = yield* KaneoApi;
  return yield* api.request("POST", "/api/task-relation", TaskRelation, {
    body: relation,
  });
});

export const deleteTaskRelation = Effect.fnUntraced(function* (id: string) {
  const api = yield* KaneoApi;
  return yield* api.request(
    "DELETE",
    `/api/task-relation/${encodeURIComponent(id)}`,
    TaskRelation,
  );
});
