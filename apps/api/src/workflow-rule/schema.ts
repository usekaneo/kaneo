import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const workflowRuleParam = z.object({ id: z.string() });

export const upsertWorkflowRuleBody = z.object({
  integrationType: z.string(),
  // RFC 0001 WP6: optional repository binding. Absent keeps the legacy
  // type-wide rule semantics.
  integrationId: z.string().optional(),
  eventType: z.string(),
  columnId: z.string(),
});
