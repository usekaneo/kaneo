import { describe, expect, it } from "vite-plus/test";
import { getCreateTaskDates } from "./calendar-create-dates";

const today = new Date(2026, 4, 15, 14, 30);

describe("getCreateTaskDates", () => {
  it("uses today as the start date", () => {
    const day = new Date(2026, 4, 15);

    expect(getCreateTaskDates(day, day, today)).toEqual({ startDate: day });
  });

  it("uses a past day as the start date", () => {
    const day = new Date(2026, 4, 2);

    expect(getCreateTaskDates(day, day, today)).toEqual({ startDate: day });
  });

  it("uses a future day as the due date", () => {
    const day = new Date(2026, 4, 20);

    expect(getCreateTaskDates(day, day, today)).toEqual({ dueDate: day });
  });

  it("sets both ends of a range in either drag direction", () => {
    const from = new Date(2026, 4, 12);
    const to = new Date(2026, 4, 18);
    const expected = { startDate: from, dueDate: to };

    expect(getCreateTaskDates(from, to, today)).toEqual(expected);
    expect(getCreateTaskDates(to, from, today)).toEqual(expected);
  });
});
