import { z } from "../openapi";

export const tangledProjectConnectionSchema = z.object({
  integrationId: z.string(),
  baseUrl: z.string(),
  repositoryId: z.string(),
  repositoryDid: z.string(),
  repositoryUrl: z.string(),
  branchPattern: z.string(),
  isActive: z.boolean(),
  hasSecret: z.boolean(),
});

export const tangledDeleteResultSchema = z.object({ success: z.literal(true) });
