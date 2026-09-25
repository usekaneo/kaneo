import { integrationEventsSchema } from "../integrations/response";
import { responseTimestamp, z } from "../openapi";

// The bot token is a bearer credential, so only a masked form is returned.
export const telegramIntegrationSchema = z
  .object({
    id: z.string(),
    projectId: z.string(),
    chatId: z.string().openapi({
      description: "The Telegram chat, group, or channel messages are sent to.",
    }),
    threadId: z.number().nullable().openapi({
      description: "Forum topic id, when the target group uses topics.",
    }),
    chatLabel: z.string().nullable().openapi({
      description: "A human-readable name for the chat, shown in the UI.",
    }),
    botTokenConfigured: z.boolean(),
    maskedBotToken: z.string(),
    events: integrationEventsSchema,
    isActive: z.boolean().nullable(),
    createdAt: responseTimestamp,
    updatedAt: responseTimestamp,
  })
  .openapi("TelegramIntegration");
