import { z } from "../openapi";

export const taskIdParam = z.object({ taskId: z.string() });
