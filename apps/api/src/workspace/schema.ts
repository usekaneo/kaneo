import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });
