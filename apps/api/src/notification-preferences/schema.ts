import { z } from "../openapi";

export const workspaceIdParam = z.object({ workspaceId: z.string() });

// Secrets are write-only: a value sets it, null clears it, omitting leaves it.
export const updatePreferencesBody = z.object({
  emailEnabled: z.boolean().optional(),
  ntfyEnabled: z.boolean().optional(),
  ntfyServerUrl: z.string().nullable().optional(),
  ntfyTopic: z.string().nullable().optional(),
  ntfyToken: z.string().nullable().optional(),
  gotifyEnabled: z.boolean().optional(),
  gotifyServerUrl: z.string().nullable().optional(),
  gotifyToken: z.string().nullable().optional(),
  webhookEnabled: z.boolean().optional(),
  webhookUrl: z.string().nullable().optional(),
  webhookSecret: z.string().nullable().optional(),
  taskAssignmentEnabled: z.boolean().optional(),
  taskCommentEnabled: z.boolean().optional(),
  taskStatusChangeEnabled: z.boolean().optional(),
  dueDateReminderEnabled: z.boolean().optional(),
  dueDateReminderLeadTimeMinutes: z
    .number()
    .int()
    .min(5)
    .max(43_200)
    .optional()
    .openapi({ description: "Between 5 minutes and 30 days." }),
});

export const upsertWorkspaceRuleBody = z.object({
  isActive: z.boolean(),
  emailEnabled: z.boolean(),
  ntfyEnabled: z.boolean(),
  gotifyEnabled: z.boolean(),
  webhookEnabled: z.boolean(),
  projectMode: z.enum(["all", "selected"]),
  selectedProjectIds: z.array(z.string()).optional().openapi({
    description: "Required in practice when projectMode is `selected`.",
  }),
});
