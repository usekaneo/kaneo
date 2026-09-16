import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const workflowRuleParam = z.object({ id: z.string() });

export const upsertWorkflowRuleBody = z.object({
  integrationType: z.string(),
  eventType: z.string(),
  columnId: z.string(),
});
