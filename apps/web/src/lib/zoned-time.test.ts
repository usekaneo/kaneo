import { describe, expect, it } from "vitest";
import { addDaysToDay, zonedClock, zonedDay, zonedInstant } from "./zoned-time";

describe("zoned time (web)", () => {
  it("shows and reads wall-clock times in the workspace timezone", () => {
    const instant = new Date("2026-09-17T04:02:00Z");
    expect(zonedClock(instant, "Asia/Dhaka")).toBe("10:02");
    expect(zonedDay(instant, "Asia/Dhaka")).toBe("2026-09-17");
    expect(
      zonedInstant("2026-09-17", "10:02", "Asia/Dhaka").toISOString(),
    ).toBe("2026-09-17T04:02:00.000Z");
    expect(addDaysToDay("2026-09-30", 1)).toBe("2026-10-01");
  });
});
