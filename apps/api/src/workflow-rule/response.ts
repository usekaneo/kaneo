import { responseTimestamp, z } from "../openapi";

export const workflowRuleSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    integrationType: z.string().openapi({
      description: "The integration that emits the event, e.g. `github`.",
    }),
    eventType: z.string().openapi({
      description:
        "The provider event that triggers the move, e.g. `pull_request.opened`.",
    }),
    columnId: z.string().openapi({
      description: "The column tasks are moved to when the event fires.",
    }),
    columnName: z.string().nullable(),
    columnSlug: z.string().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("WorkflowRule");

export const workflowRuleListSchema = z.array(workflowRuleSchema);

export const workflowRuleRowSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    integrationType: z.string(),
    eventType: z.string(),
    columnId: z.string(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("WorkflowRuleRow");
