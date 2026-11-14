import { z } from "../openapi";

export const projectIdParam = z.object({ projectId: z.string() });

export const workflowRuleParam = z.object({ id: z.string() });

const workflowEventTypes = [
  "branch_push",
  "pr_opened",
  "pr_merged",
  "issue_opened",
  "issue_closed",
  "issue_reopened",
] as const;

export const upsertWorkflowRuleBody = z
  .object({
    integrationType: z.string(),
    eventType: z
      .enum(workflowEventTypes)
      .describe(
        "Tangled supports only branch_push; pull request and issue events are not available.",
      ),
    columnId: z.string(),
  })
  .refine(
    (body) =>
      body.integrationType !== "tangled" || body.eventType === "branch_push",
    {
      message: "Tangled supports only branch push workflow rules",
      path: ["eventType"],
    },
  );
