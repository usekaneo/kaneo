import type { TFunction } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import {
  describeAutomationTrigger,
  isoToJsWeekday,
  jsToIsoWeekday,
} from "./describe-automation-trigger";

const t = ((key: string, values?: Record<string, unknown>) =>
  values ? `${key} ${JSON.stringify(values)}` : key) as unknown as TFunction;

const schedule = {
  type: "schedule" as const,
  frequency: "weekly" as const,
  time: "16:00",
  weekdays: [5, 1],
  intervalHours: null,
  timezone: "America/New_York",
};

describe("describeAutomationTrigger", () => {
  it("lists weekdays in order with the local time and zone", () => {
    expect(describeAutomationTrigger(schedule, t, "en-US")).toMatch(
      /^agent:automations\.trigger\.weeklyAt \{"days":"Mon, Fri","time":"4:00\sPM"\} · America\/New_York$/,
    );
  });

  it("treats every weekday as daily", () => {
    expect(
      describeAutomationTrigger(
        { ...schedule, weekdays: [1, 2, 3, 4, 5, 6, 7], time: "09:00" },
        t,
        "en-GB",
      ),
    ).toBe(
      'agent:automations.trigger.dailyAt {"time":"9:00"} · America/New_York',
    );
  });

  it("describes intervals without a time", () => {
    expect(
      describeAutomationTrigger(
        { ...schedule, frequency: "interval", intervalHours: 6 },
        t,
        "en-US",
      ),
    ).toBe('agent:automations.trigger.everyHours {"count":6}');
  });

  it("adds event filters", () => {
    expect(
      describeAutomationTrigger(
        {
          type: "event",
          event: "task_moved",
          filters: { labelName: "Bug", columnName: "Done", projectId: "p1" },
        },
        t,
        "en-US",
        (id) => (id === "p1" ? "API" : undefined),
      ),
    ).toBe(
      'agent:automations.events.task_moved · agent:automations.filters.labelIs {"name":"Bug"} · agent:automations.filters.columnIs {"name":"Done"} · agent:automations.filters.projectIs {"name":"API"}',
    );
  });
});

describe("weekday conversion", () => {
  it("maps ISO Sunday to JavaScript Sunday and back", () => {
    expect(isoToJsWeekday(7)).toBe(0);
    expect(isoToJsWeekday(1)).toBe(1);
    expect(jsToIsoWeekday(0)).toBe(7);
    expect(jsToIsoWeekday(6)).toBe(6);
  });
});
