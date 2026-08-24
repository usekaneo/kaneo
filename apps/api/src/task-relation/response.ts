import { responseTimestamp, z } from "../openapi";

const relationTypeDescription =
  "How the two tasks relate: `subtask`, `blocks`, or `related`.";

const relatedTaskSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    status: z.string(),
    priority: z.string().nullable(),
    number: z.number().nullable(),
    projectId: z.string(),
    userId: z.string().nullable(),
    assigneeName: z.string().nullable(),
  })
  .openapi("RelatedTask");

export const taskRelationSchema = z
  .object({
    id: z.string(),
    sourceTaskId: z.string(),
    targetTaskId: z.string(),
    relationType: z.string().openapi({ description: relationTypeDescription }),
    createdAt: responseTimestamp,
  })
  .openapi("TaskRelation");

// Always present in practice: relations whose endpoints are not both visible in
// the workspace are dropped. Nullable only because the lookup is a map read.
export const taskRelationWithTasksSchema = taskRelationSchema
  .extend({
    sourceTask: relatedTaskSchema.nullable(),
    targetTask: relatedTaskSchema.nullable(),
  })
  .openapi("TaskRelationWithTasks");

export const taskRelationWithTasksListSchema = z.array(
  taskRelationWithTasksSchema,
);
