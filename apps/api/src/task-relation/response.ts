import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

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
    // Included so a caller (the Gantt chart) can place a related task that
    // belongs to a different project on its own timeline, and label it with
    // that project's name/slug, without a second request.
    projectName: z.string(),
    projectSlug: z.string(),
    userId: z.string().nullable(),
    assigneeName: z.string().nullable(),
    startDate: nullableResponseTimestamp,
    dueDate: nullableResponseTimestamp,
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
