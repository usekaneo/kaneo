import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });

export const createExternalLinkBody = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
});
