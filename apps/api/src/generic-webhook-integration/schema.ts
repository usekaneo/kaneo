import { genericWebhookEventToggles } from "../integrations/schema";
import { z } from "../openapi";

const leadTimeMinutes = z
  .number()
  .int()
  .min(5)
  .max(43_200)
  .openapi({ description: "Between 5 minutes and 30 days." });

export const createWebhookBody = z.object({
  webhookUrl: z.string().min(1),
  secret: z.string().optional().openapi({
    description: "Optional HMAC secret used to sign outgoing deliveries.",
  }),
  events: genericWebhookEventToggles.optional(),
  dueDateReminderLeadTimeMinutes: leadTimeMinutes.optional(),
});

export const updateWebhookBody = z.object({
  webhookUrl: z.string().optional(),
  secret: z.string().nullable().optional().openapi({
    description: "Send null to remove the signing secret.",
  }),
  isActive: z.boolean().optional(),
  events: genericWebhookEventToggles.optional(),
  dueDateReminderLeadTimeMinutes: leadTimeMinutes.optional(),
});
