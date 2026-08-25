import { z } from "../openapi";

export const labelParam = z.object({ id: z.string() });

export const taskIdParam = z.object({ taskId: z.string() });

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const createLabelBody = z.object({
  name: z.string(),
  color: z.string(),
  workspaceId: z.string(),
  taskId: z.string().optional(),
});

export const updateLabelBody = z.object({
  name: z.string(),
  color: z.string(),
});

export const attachLabelBody = z.object({ taskId: z.string() });
