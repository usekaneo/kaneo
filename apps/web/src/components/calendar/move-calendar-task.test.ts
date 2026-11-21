import { differenceInCalendarDays, parseISO } from "date-fns";
import { describe, expect, it } from "vite-plus/test";
import { moveCalendarTask } from "./move-calendar-task";

const calendarDay = (iso: string) => {
  const date = parseISO(iso);
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()];
};

describe("moveCalendarTask", () => {
  it("moves a due-only task without inventing its start date", () => {
    const task = { startDate: null, dueDate: "2026-11-16T00:00:00.000Z" };
    const result = moveCalendarTask(task, new Date(2026, 10, 19));
    expect(result?.startDate).toBeNull();
    expect(calendarDay(result!.dueDate!)).toEqual([2026, 11, 19]);
    expect(task.dueDate).toBe("2026-11-16T00:00:00.000Z");
  });

  it("moves a start-only task without inventing its due date", () => {
    const result = moveCalendarTask(
      { startDate: "2026-11-16", dueDate: null },
      new Date(2026, 10, 22),
    );
    expect(result?.dueDate).toBeNull();
    expect(calendarDay(result!.startDate!)).toEqual([2026, 11, 22]);
  });

  it("preserves a range and moves it across month boundaries", () => {
    const result = moveCalendarTask(
      { startDate: "2026-11-29", dueDate: "2026-12-02" },
      new Date(2026, 11, 5),
    );
    expect(calendarDay(result!.startDate!)).toEqual([2026, 12, 5]);
    expect(calendarDay(result!.dueDate!)).toEqual([2026, 12, 8]);
    expect(
      differenceInCalendarDays(
        parseISO(result!.dueDate!),
        parseISO(result!.startDate!),
      ),
    ).toBe(3);
  });

  it("preserves calendar duration across daylight saving changes", () => {
    const result = moveCalendarTask(
      { startDate: "2026-03-28", dueDate: "2026-03-30" },
      new Date(2026, 9, 24),
    );
    expect(
      differenceInCalendarDays(
        parseISO(result!.dueDate!),
        parseISO(result!.startDate!),
      ),
    ).toBe(2);
  });

  it("ignores invalid or same-day drops", () => {
    const task = { startDate: null, dueDate: "2026-11-16" };
    expect(moveCalendarTask(task, new Date(2026, 10, 16))).toBeNull();
    expect(moveCalendarTask(task, new Date(Number.NaN))).toBeNull();
  });
});
