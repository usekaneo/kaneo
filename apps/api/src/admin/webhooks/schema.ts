import { z } from "../../openapi";

import { WEBHOOK_CATEGORIES } from "./categories";

export const webhookInput = z.object({
  url: z.url().max(2048),
  categories: z
    .array(z.enum(WEBHOOK_CATEGORIES))
    .min(1)
    .max(WEBHOOK_CATEGORIES.length),
  enabled: z.boolean(),
});
export type WebhookInput = z.infer<typeof webhookInput>;
export const webhookParam = z.object({ webhookId: z.string().min(1) });
export const webhookSchema = webhookInput
  .extend({
    id: z.string(),
    createdAt: z.iso.datetime(),
  })
  .openapi("InstanceWebhook");
export const webhookSecretSchema = z
  .object({ webhook: webhookSchema, secret: z.string() })
  .openapi("InstanceWebhookSecret");
export const webhookListSchema = z
  .object({
    webhooks: z.array(webhookSchema),
    signingConfigured: z.boolean(),
  })
  .openapi("InstanceWebhookList");
export const deliverySchema = z
  .object({
    id: z.string(),
    action: z.string(),
    eventId: z.string(),
    state: z.enum(["pending", "succeeded", "failed"]),
    attempts: z.number().int(),
    statusCode: z.number().int().nullable(),
    errorCode: z.string().nullable(),
    createdAt: z.iso.datetime(),
  })
  .openapi("InstanceWebhookDelivery");
export const queuedSchema = z
  .object({ id: z.string() })
  .openapi("InstanceWebhookQueued");
