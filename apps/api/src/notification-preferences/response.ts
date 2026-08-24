import { nullableResponseTimestamp, responseTimestamp, z } from "../openapi";

// Secrets are never returned: each is a *Configured boolean plus a masked preview.
export const workspaceRuleSchema = z
  .object({
    id: z.string(),
    workspaceId: z.string(),
    workspaceName: z.string(),
    isActive: z.boolean().openapi({
      description: "Turn all notifications for this workspace on or off.",
    }),
    emailEnabled: z.boolean(),
    ntfyEnabled: z.boolean(),
    gotifyEnabled: z.boolean(),
    webhookEnabled: z.boolean(),
    projectMode: z.enum(["all", "selected"]).openapi({
      description:
        "`all` notifies for every project in the workspace; `selected` restricts it to selectedProjectIds.",
    }),
    selectedProjectIds: z.array(z.string()),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("NotificationPreferenceWorkspaceRule");

export const notificationPreferenceSchema = z
  .object({
    emailAddress: z.string().nullable(),
    emailEnabled: z.boolean(),
    ntfyEnabled: z.boolean(),
    ntfyConfigured: z.boolean(),
    ntfyServerUrl: z.string().nullable(),
    ntfyTopic: z.string().nullable(),
    ntfyTokenConfigured: z.boolean(),
    maskedNtfyToken: z.string().nullable(),
    gotifyEnabled: z.boolean(),
    gotifyConfigured: z.boolean(),
    gotifyServerUrl: z.string().nullable(),
    gotifyTokenConfigured: z.boolean(),
    maskedGotifyToken: z.string().nullable(),
    webhookEnabled: z.boolean(),
    webhookConfigured: z.boolean(),
    webhookUrl: z.string().nullable(),
    webhookSecretConfigured: z.boolean(),
    maskedWebhookSecret: z.string().nullable(),
    taskAssignmentEnabled: z.boolean(),
    taskCommentEnabled: z.boolean(),
    taskStatusChangeEnabled: z.boolean(),
    dueDateReminderEnabled: z.boolean(),
    dueDateReminderLeadTimeMinutes: z.number().openapi({
      description: "How long before a due date the reminder fires, in minutes.",
    }),
    workspaces: z.array(workspaceRuleSchema).openapi({
      description:
        "Per-workspace overrides. A workspace with no rule follows the global settings.",
    }),
    createdAt: nullableResponseTimestamp,
    updatedAt: nullableResponseTimestamp,
  })
  .openapi("NotificationPreferences");
