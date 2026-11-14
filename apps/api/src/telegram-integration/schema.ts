import { integrationEventToggles } from "../integrations/schema";
import { z } from "../openapi";
import { isPlainServerUrl } from "../plugins/telegram/config";

const telegramServerUrl = z
  .url({ protocol: /^https?$/ })
  .refine(
    isPlainServerUrl,
    "Bot API server URL must not contain a query, fragment, or credentials",
  );

export const createTelegramBody = z.object({
  botToken: z.string().min(1).openapi({
    description: "A Telegram bot token, in the form 123456789:AA...",
  }),
  serverUrl: telegramServerUrl.optional().openapi({
    description:
      "An http(s) URL of a self-hosted Bot API server, without a query, fragment, or credentials. Defaults to https://api.telegram.org.",
  }),
  chatId: z.string().min(1),
  threadId: z.number().optional(),
  chatLabel: z.string().optional(),
  events: integrationEventToggles.optional(),
});

// Must match TelegramIntegrationPatchBody in controllers/telegram-controller.
export const updateTelegramBody = z.object({
  botToken: z.string().optional(),
  serverUrl: telegramServerUrl.nullable().optional().openapi({
    description:
      "An http(s) URL of a self-hosted Bot API server, without a query, fragment, or credentials, or null to use https://api.telegram.org. Changing it requires the bot token.",
  }),
  chatId: z.string().optional(),
  threadId: z.number().nullable().optional(),
  chatLabel: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
  events: integrationEventToggles.optional(),
});
