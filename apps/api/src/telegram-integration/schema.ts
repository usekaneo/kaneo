import { integrationEventToggles } from "../integrations/schema";
import { z } from "../openapi";

export const createTelegramBody = z.object({
  botToken: z.string().min(1).openapi({
    description: "A Telegram bot token, in the form 123456789:AA...",
  }),
  serverUrl: z.url().optional().openapi({
    description:
      "A self-hosted Bot API server. Defaults to https://api.telegram.org.",
  }),
  chatId: z.string().min(1),
  threadId: z.number().optional(),
  chatLabel: z.string().optional(),
  events: integrationEventToggles.optional(),
});

// Must match TelegramIntegrationPatchBody in controllers/telegram-controller.
export const updateTelegramBody = z.object({
  botToken: z.string().optional(),
  serverUrl: z.url().nullable().optional().openapi({
    description:
      "A self-hosted Bot API server, or null to use https://api.telegram.org. Changing it requires the bot token.",
  }),
  chatId: z.string().optional(),
  threadId: z.number().nullable().optional(),
  chatLabel: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  events: integrationEventToggles.optional(),
});
