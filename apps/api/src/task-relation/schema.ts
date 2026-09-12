import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const taskRelationParam = z.object({ id: z.string() });

export const createTaskRelationBody = z.object({
  sourceTaskId: z.string(),
  targetTaskId: z.string(),
  relationType: z.enum(["subtask", "blocks", "related"]),
});
