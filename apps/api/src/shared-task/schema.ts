import { z } from "../openapi";
import { descriptionPageQuery } from "../task/schema";

export const taskShareTaskParam = z.object({ taskId: z.string().min(1) });

export const sharedTaskTokenParam = z.object({ token: z.string() });

export const sharedTaskAssetParam = sharedTaskTokenParam.extend({
  assetId: z.string().min(1),
});

export const sharedTaskDescriptionQuery = descriptionPageQuery;
