import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const deletedSchema = z.object({ success: z.boolean() });

export const projectIdBody = z.object({ projectId: z.string() });
