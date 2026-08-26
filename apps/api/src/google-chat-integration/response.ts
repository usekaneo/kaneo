import { integrationEventsSchema } from "../integrations/response";
import { responseTimestamp, z } from "../openapi";

// The webhook URL is a bearer credential, so only a masked form is returned.
export const googleChatIntegrationSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    channelName: z.string().nullable(),
    webhookConfigured: z.boolean(),
    maskedWebhookUrl: z.string().openapi({
      description:
        "The Google Chat webhook URL with its space, key, and token masked.",
    }),
    events: integrationEventsSchema,
    isActive: z.boolean().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("GoogleChatIntegration");
