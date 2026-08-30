import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

export const createCheckoutBody = z.object({
  plan: z.enum(["personal", "team"]),
  interval: z.enum(["monthly", "annual"]),
});
