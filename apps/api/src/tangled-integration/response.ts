import { z } from "../openapi";
import { tangledOutcomeCodes } from "../plugins/tangled/outcome-types";

export const tangledProjectConnectionSchema = z.object({
  integrationId: z.string(),
  webhookUrl: z
    .string()
    .describe("Public URL for signed Tangled webhook deliveries"),
  baseUrl: z.string(),
  repositoryId: z.string(),
  repositoryDid: z.string(),
  repositoryUrl: z.string(),
  branchPattern: z.string(),
  isActive: z.boolean(),
  hasSecret: z.boolean(),
});

export const tangledOutcomeSchema = z.object({
  eventType: z.enum(["push", "pull_request", "reconciliation"]),
  outcome: z.enum(["applied", "skipped", "failed"]),
  code: z.enum(tangledOutcomeCodes),
  ref: z.string().nullable(),
  checkedAt: z.string().datetime(),
});

export const tangledDeleteResultSchema = z.object({ success: z.literal(true) });
