import { integrationEventsSchema } from "../integrations/response";
import { integrationEventToggles } from "../integrations/schema";
import { z } from "../openapi";

export const telegramIntegrationEventToggles = integrationEventToggles.extend({
  taskAssigneeChanged: z.boolean().optional(),
});

export const telegramIntegrationEventsSchema = integrationEventsSchema
  .extend({
    taskAssigneeChanged: z.boolean(),
  })
  .openapi("TelegramIntegrationEvents");
