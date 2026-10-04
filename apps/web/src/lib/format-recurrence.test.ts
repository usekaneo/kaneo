import type { TFunction } from "i18next";
import { describe, expect, it } from "vite-plus/test";
import { formatRecurrence, formatWeekday } from "./format-recurrence";

const t = ((key: string, options: Record<string, unknown>) =>
  `${key}:${JSON.stringify(options)}`) as unknown as TFunction;

describe("formatRecurrence", () => {
  it("uses the frequency's plural key with the interval as count", () => {
    expect(
      formatRecurrence(t, { frequency: "monthly", interval: 3 }, "en-US"),
    ).toBe('tasks:recurrence.monthly:{"count":3}');
  });

  it("names the weekdays of weekly rules, Monday first", () => {
    expect(
      formatRecurrence(
        t,
        { frequency: "weekly", interval: 2, weekdays: [5, 0, 1] },
        "en-US",
      ),
    ).toBe(
      `tasks:recurrence.onDays:${JSON.stringify({
        rule: 'tasks:recurrence.weekly:{"count":2}',
        days: "Monday, Friday, and Sunday",
      })}`,
    );
  });
});

describe("formatWeekday", () => {
  it("formats weekday numbers starting from Sunday", () => {
    expect(formatWeekday(0, "en-US")).toBe("Sunday");
    expect(formatWeekday(5, "en-US", "narrow")).toBe("F");
    expect(formatWeekday(1, "es-ES", "short")).toBe("lun");
  });
});
