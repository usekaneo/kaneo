import { z } from "../openapi";
import { syncProviders, syncRulesSchema } from "../plugins/sync/rules";

export const syncParams = z.object({
  projectId: z.string().min(1),
  provider: z.enum(syncProviders),
});
export const rulesBody = z.object({ rules: syncRulesSchema });
export const saveRulesBody = rulesBody.extend({
  previewToken: z.string().length(64),
});
export const resumeParams = syncParams.extend({ linkId: z.string().min(1) });
export const resumeBody = z.object({
  token: z.string().length(64),
  source: z.enum(["kaneo", "provider"]),
});

const taskSample = z.object({
  id: z.string(),
  number: z.number().nullable(),
  title: z.string(),
});
export const syncPreviewSchema = z
  .object({
    isActive: z.boolean(),
    rules: syncRulesSchema,
    labels: z.array(
      z.object({ id: z.string(), name: z.string(), color: z.string() }),
    ),
    missingLabels: z.array(z.string()),
    total: z.number(),
    matching: z.number(),
    willCreate: z.number(),
    willPause: z.number(),
    needsReview: z.number(),
    paused: z.number(),
    matchingTasks: z.array(taskSample),
    pausedNextCursor: z.string().nullable(),
    pausedTasks: z.array(
      taskSample.extend({
        linkId: z.string(),
        url: z.string(),
        eligible: z.boolean(),
      }),
    ),
    previewToken: z.string(),
  })
  .openapi("IntegrationSyncPreview");

const syncValues = z.object({
  title: z.string(),
  description: z.string(),
  state: z.enum(["open", "closed"]),
});
export const resumePreviewSchema = z
  .object({
    task: taskSample,
    local: syncValues,
    remote: syncValues,
    token: z.string(),
  })
  .openapi("IntegrationSyncResumePreview");
