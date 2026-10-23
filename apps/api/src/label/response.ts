import { responseTimestamp, z } from "../openapi";

export const labelSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    color: z.string(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
    deletionStartedAt: responseTimestamp.nullable().optional(),
    taskId: z.string().nullable(),
    workspaceId: z.string().nullable(),
  })
  .openapi("Label");

export const labelListSchema = z.array(labelSchema);

export const pendingLabelDeletionSchema = labelSchema
  .extend({ pendingDeletion: z.literal(true) })
  .openapi("PendingLabelDeletion");

export const labelSummarySchema = z
  .object({ id: z.string(), name: z.string(), color: z.string() })
  .openapi("LabelSummary");

export const pinnedLabelSchema = labelSummarySchema
  .extend({ workspaceId: z.string().nullable() })
  .openapi("PinnedLabel");

export const labelPinSchema = z
  .object({ id: z.string(), pinned: z.boolean() })
  .openapi("LabelPin");

export const projectDefaultLabelSchema = labelSummarySchema
  .extend({ projectId: z.string() })
  .openapi("ProjectDefaultLabel");
