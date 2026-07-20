import { describe, expect, it } from "vitest";
import {
  defaultGenericWebhookEvents,
  normalizeGenericWebhookConfig,
} from "../../../../apps/api/src/plugins/generic-webhook/config";

describe("generic webhook reminder config", () => {
  it("keeps reminders opt-in with a one-day default lead time", () => {
    const config = normalizeGenericWebhookConfig({
      webhookUrl: "https://example.com/hooks/kaneo",
    });

    expect(config.events).toEqual(defaultGenericWebhookEvents);
    expect(config.events?.dueDateReminder).toBe(false);
    expect(config.events?.taskDeleted).toBe(false);
    expect(config.events?.taskMoved).toBe(false);
    expect(config.events?.taskDueDateChanged).toBe(false);
    expect(config.events?.taskAssigneeChanged).toBe(false);
    expect(config.events?.taskUnassigned).toBe(false);
    expect(config.dueDateReminderLeadTimeMinutes).toBe(1440);
  });

  it("preserves a configured reminder lead time", () => {
    const config = normalizeGenericWebhookConfig({
      webhookUrl: "https://example.com/hooks/kaneo",
      events: { dueDateReminder: true },
      dueDateReminderLeadTimeMinutes: 2880,
    });

    expect(config.events?.dueDateReminder).toBe(true);
    expect(config.dueDateReminderLeadTimeMinutes).toBe(2880);
  });
});
