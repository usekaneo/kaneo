import { describe, expect, it } from "vite-plus/test";
import { defaultDueWeekStart, weekRange } from "./due-week-start";

describe("defaultDueWeekStart", () => {
  it("starts the week on Monday at midnight UTC", () => {
    expect(
      defaultDueWeekStart(new Date("2026-10-23T15:30:00Z")).toISOString(),
    ).toBe("2026-10-19T00:00:00.000Z");
    expect(
      defaultDueWeekStart(new Date("2026-10-25T23:59:00Z")).toISOString(),
    ).toBe("2026-10-19T00:00:00.000Z");
    expect(
      defaultDueWeekStart(new Date("2026-10-26T00:00:00Z")).toISOString(),
    ).toBe("2026-10-26T00:00:00.000Z");
  });
});

describe("weekRange", () => {
  it("covers seven days from the given week on", () => {
    const start = new Date("2026-10-19T00:00:00Z");
    const next = weekRange(start, 1);
    expect(next.start.toISOString()).toBe("2026-10-26T00:00:00.000Z");
    expect(next.end.toISOString()).toBe("2026-11-02T00:00:00.000Z");
  });
});
