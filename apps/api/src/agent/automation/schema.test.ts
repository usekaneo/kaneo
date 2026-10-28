import { describe, expect, it } from "vite-plus/test";
import { createAutomationSchema } from "./schema";

const base = {
  name: "Review",
  prompt: "Review tasks",
  output: "proposals",
  trigger: { type: "schedule", frequency: "daily" },
};

describe("automation input validation", () => {
  it("defaults to UTC, 09:00, enabled, and 24 runs per rolling day", () => {
    expect(createAutomationSchema.parse(base)).toMatchObject({
      enabled: true,
      dailyRunLimit: 24,
      trigger: { time: "09:00", timezone: "UTC" },
    });
  });
  it.each([
    { name: "" },
    { prompt: "" },
    { dailyRunLimit: 0 },
    { dailyRunLimit: 101 },
    { trigger: { ...base.trigger, timezone: "Mars/Olympus" } },
    { trigger: { ...base.trigger, time: "25:00" } },
    { trigger: { ...base.trigger, frequency: "weekly", weekdays: [] } },
    {
      trigger: { ...base.trigger, frequency: "interval", intervalHours: null },
    },
    { trigger: { type: "event", event: "anything" } },
    {
      trigger: {
        type: "event",
        event: "task_created",
        filters: { projectId: "" },
      },
    },
  ])("rejects invalid automation settings %j", (change) => {
    expect(
      createAutomationSchema.safeParse({ ...base, ...change }).success,
    ).toBe(false);
  });
});
