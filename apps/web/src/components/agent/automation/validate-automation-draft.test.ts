import { describe, expect, it } from "vite-plus/test";
import { createAutomationDraft } from "./automation-draft";
import { validateAutomationDraft } from "./validate-automation-draft";

const valid = {
  ...createAutomationDraft("Europe/Berlin"),
  name: "Monday digest",
  prompt: "List overdue work",
};

describe("validateAutomationDraft", () => {
  it("accepts a complete weekly schedule", () => {
    expect(validateAutomationDraft(valid)).toEqual({});
  });

  it("requires a name and a prompt", () => {
    expect(
      validateAutomationDraft({ ...valid, name: "  ", prompt: "\n" }),
    ).toEqual({
      name: "agent:automations.form.errors.nameRequired",
      prompt: "agent:automations.form.errors.promptRequired",
    });
  });

  it("enforces the API's prompt length and mention limits", () => {
    expect(
      validateAutomationDraft({ ...valid, prompt: "x".repeat(16001) }).prompt,
    ).toBe("agent:automations.form.errors.promptTooLong");
    const mentions = Array.from(
      { length: 11 },
      (_, index) => `@[Task ${index}](task:t${index})`,
    ).join(" ");
    expect(validateAutomationDraft({ ...valid, prompt: mentions }).prompt).toBe(
      "agent:automations.form.errors.tooManyMentions",
    );
    const repeated = Array.from({ length: 11 }, () => "@[Same](task:t1)").join(
      " ",
    );
    expect(validateAutomationDraft({ ...valid, prompt: repeated })).toEqual({});
  });

  it("needs a weekday for weekly schedules", () => {
    expect(validateAutomationDraft({ ...valid, weekdays: [] })).toEqual({
      weekdays: "agent:automations.form.errors.weekdays",
    });
    expect(
      validateAutomationDraft({ ...valid, frequency: "daily", weekdays: [] }),
    ).toEqual({});
  });

  it("checks the time only when the schedule uses one", () => {
    expect(validateAutomationDraft({ ...valid, time: "24:00" }).time).toBe(
      "agent:automations.form.errors.time",
    );
    expect(
      validateAutomationDraft({
        ...valid,
        frequency: "interval",
        time: "",
      }),
    ).toEqual({});
  });

  it("bounds intervals to 1–24 hours", () => {
    for (const intervalHours of [0, 25, 1.5, Number.NaN])
      expect(
        validateAutomationDraft({
          ...valid,
          frequency: "interval",
          intervalHours,
        }).intervalHours,
      ).toBe("agent:automations.form.errors.intervalHours");
  });

  it("bounds the daily run cap to the server maximum", () => {
    expect(validateAutomationDraft({ ...valid, dailyRunLimit: 100 })).toEqual(
      {},
    );
    for (const dailyRunLimit of [0, 101, Number.NaN])
      expect(
        validateAutomationDraft({ ...valid, dailyRunLimit }).dailyRunLimit,
      ).toBe("agent:automations.form.errors.dailyRunLimit");
  });

  it("ignores schedule fields for event triggers", () => {
    expect(
      validateAutomationDraft({
        ...valid,
        triggerType: "event",
        weekdays: [],
        time: "",
      }),
    ).toEqual({});
  });
});
