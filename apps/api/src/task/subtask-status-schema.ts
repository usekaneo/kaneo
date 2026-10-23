import { z } from "../openapi";

export const subtaskStatusQuery = z.object({ status: z.string().min(1) });
export const subtaskStatusBody = subtaskStatusQuery.extend({
  taskIds: z.array(z.string().min(1)).min(1).max(1000),
});
export const subtaskStatusPreviewSchema = z.object({
  parentTitle: z.string(),
  status: z.string(),
  statusName: z.string(),
  subtasks: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      projectId: z.string(),
      status: z.string(),
      assigneeName: z.string().nullable(),
      destinationStatus: z.string().nullable(),
    }),
  ),
});
