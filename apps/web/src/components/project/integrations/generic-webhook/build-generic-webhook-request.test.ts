import { describe, expect, it } from "vite-plus/test";
import { buildGenericWebhookRequest } from "./build-generic-webhook-request";
import { toGenericWebhookEvents } from "./generic-webhook-events";
import type { GenericWebhookFormValues } from "./generic-webhook-form-values";

function values(
  overrides: Partial<GenericWebhookFormValues> = {},
): GenericWebhookFormValues {
  return {
    webhookUrl: "https://example.com/hooks/kaneo",
    secret: "",
    events: toGenericWebhookEvents(),
    dueDateReminderLeadTimeHours: 24,
    ...overrides,
  };
}

describe("buildGenericWebhookRequest", () => {
  it("requires a valid endpoint before connecting", () => {
    expect(
      buildGenericWebhookRequest(values({ webhookUrl: "" }), false),
    ).toEqual({ kind: "invalid" });
    expect(
      buildGenericWebhookRequest(values({ webhookUrl: "not a url" }), true),
    ).toEqual({ kind: "invalid" });
  });

  it("keeps the saved endpoint when the field is left empty", () => {
    expect(
      buildGenericWebhookRequest(values({ webhookUrl: "  " }), true),
    ).toEqual({
      kind: "update",
      json: {
        webhookUrl: undefined,
        secret: undefined,
        events: toGenericWebhookEvents(),
      },
    });
  });

  it("sends the reminder lead time in minutes only when reminders are on", () => {
    const events = { ...toGenericWebhookEvents(), dueDateReminder: true };

    expect(
      buildGenericWebhookRequest(
        values({ events, dueDateReminderLeadTimeHours: 1.5, secret: " s " }),
        false,
      ),
    ).toEqual({
      kind: "create",
      data: {
        webhookUrl: "https://example.com/hooks/kaneo",
        secret: "s",
        events,
        dueDateReminderLeadTimeMinutes: 90,
      },
    });
    expect(buildGenericWebhookRequest(values(), false)).toEqual({
      kind: "create",
      data: {
        webhookUrl: "https://example.com/hooks/kaneo",
        secret: undefined,
        events: toGenericWebhookEvents(),
      },
    });
  });
});
