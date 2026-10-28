import { z } from "zod/v4";
import type { CreateGenericWebhookIntegrationRequest } from "@/fetchers/generic-webhook-integration/create-generic-webhook-integration";
import type { UpdateGenericWebhookIntegrationRequest } from "@/fetchers/generic-webhook-integration/update-generic-webhook-integration";
import type { GenericWebhookFormValues } from "./generic-webhook-form-values";

export type GenericWebhookRequest =
  | { kind: "invalid" }
  | { kind: "create"; data: CreateGenericWebhookIntegrationRequest }
  | { kind: "update"; json: UpdateGenericWebhookIntegrationRequest };

export function buildGenericWebhookRequest(
  values: GenericWebhookFormValues,
  connected: boolean,
): GenericWebhookRequest {
  const webhookUrl = values.webhookUrl.trim();
  const secret = values.secret.trim();
  const validUrl = z.url().safeParse(webhookUrl).success;

  if (!validUrl && (!connected || webhookUrl)) {
    return { kind: "invalid" };
  }

  const leadTime = values.events.dueDateReminder
    ? {
        dueDateReminderLeadTimeMinutes: Math.round(
          values.dueDateReminderLeadTimeHours * 60,
        ),
      }
    : {};

  if (!connected) {
    return {
      kind: "create",
      data: {
        webhookUrl,
        secret: secret || undefined,
        events: values.events,
        ...leadTime,
      },
    };
  }

  return {
    kind: "update",
    json: {
      webhookUrl: webhookUrl || undefined,
      secret: secret || undefined,
      events: values.events,
      ...leadTime,
    },
  };
}
