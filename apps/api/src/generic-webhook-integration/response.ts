import { genericWebhookEventsSchema } from "../integrations/response";
import { responseTimestamp, z } from "../openapi";

// Credentials are only ever returned masked, with a boolean saying if each is set.
export const genericWebhookIntegrationSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    webhookConfigured: z.boolean(),
    maskedWebhookUrl: z.string().nullable(),
    secretConfigured: z.boolean(),
    maskedSecret: z.string().nullable().openapi({
      description:
        "A preview of the HMAC signing secret used to sign outgoing deliveries.",
    }),
    events: genericWebhookEventsSchema,
    dueDateReminderLeadTimeMinutes: z.number().openapi({
      description:
        "How long before a due date the dueDateReminder event fires, in minutes.",
    }),
    isActive: z.boolean().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("GenericWebhookIntegration");
