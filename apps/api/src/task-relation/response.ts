import { responseTimestamp, z } from "../openapi";

const relationTypeDescription =
  "How the two tasks relate: `subtask`, `blocks`, or `related`.";

// The joined task summary, restricted to the caller's workspace.
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

// getTaskRelations drops any relation whose endpoints are not both visible in
// the workspace, so in practice these are always present; they stay nullable
// because the lookup itself is a map read.
export const taskRelationWithTasksSchema = taskRelationSchema
  .extend({
    sourceTask: relatedTaskSchema.nullable(),
    targetTask: relatedTaskSchema.nullable(),
  })
  .openapi("TaskRelationWithTasks");

export const taskRelationWithTasksListSchema = z.array(
  taskRelationWithTasksSchema,
);
