import { describe, expect, it } from "vite-plus/test";
import { getRelativeDueDate } from "./relative-due-date";

const now = new Date(2026, 9, 14, 9, 30);

describe("getRelativeDueDate", () => {
  it("counts calendar days, not 24 hour blocks", () => {
    expect(getRelativeDueDate(new Date(2026, 9, 13, 23, 59), now)).toEqual({
      kind: "overdue",
      days: 1,
      weeks: 0,
    });
    expect(getRelativeDueDate(new Date(2026, 9, 15, 0, 1), now)).toEqual({
      kind: "tomorrow",
    });
  });

  it("names today and tomorrow", () => {
    expect(getRelativeDueDate(new Date(2026, 9, 14, 18), now)).toEqual({
      kind: "today",
    });
    expect(getRelativeDueDate(new Date(2026, 9, 15), now)).toEqual({
      kind: "tomorrow",
    });
  });

  it("counts days up to six days out", () => {
    expect(getRelativeDueDate(new Date(2026, 9, 17), now)).toEqual({
      kind: "soon",
      days: 3,
    });
    expect(getRelativeDueDate(new Date(2026, 9, 20), now)).toEqual({
      kind: "soon",
      days: 6,
    });
  });

  it("falls back to the date a week or more out", () => {
    expect(getRelativeDueDate(new Date(2026, 9, 21), now)).toEqual({
      kind: "date",
      sameYear: true,
    });
    expect(getRelativeDueDate(new Date(2027, 0, 8), now)).toEqual({
      kind: "date",
      sameYear: false,
    });
  });

  it("switches overdue to weeks after two weeks", () => {
    expect(getRelativeDueDate(new Date(2026, 9, 1), now)).toEqual({
      kind: "overdue",
      days: 13,
      weeks: 1,
    });
    expect(getRelativeDueDate(new Date(2026, 8, 23), now)).toEqual({
      kind: "overdue",
      days: 21,
      weeks: 3,
    });
  });
});
