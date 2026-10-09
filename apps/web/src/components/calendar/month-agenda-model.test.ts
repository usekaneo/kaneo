import { describe, expect, it } from "vite-plus/test";
import { buildMonthAgenda } from "./month-agenda-model";

const task = (id: string, start: string, end: string) => ({
  id,
  scheduleStart: new Date(start),
  scheduleEnd: new Date(end),
});

describe("buildMonthAgenda", () => {
  it("lists only days of the month that have tasks, in order", () => {
    const agenda = buildMonthAgenda(new Date(2026, 9, 1), [
      task("b", "2026-10-12T00:00:00", "2026-10-12T00:00:00"),
      task("a", "2026-10-03T00:00:00", "2026-10-03T00:00:00"),
    ]);

    expect(agenda.map((entry) => entry.day.getDate())).toEqual([3, 12]);
    expect(agenda[0]?.tasks.map((t) => t.id)).toEqual(["a"]);
  });

  it("repeats a multi-day task on every day it spans", () => {
    const agenda = buildMonthAgenda(new Date(2026, 9, 1), [
      task("span", "2026-10-07T00:00:00", "2026-10-09T00:00:00"),
    ]);

    expect(agenda.map((entry) => entry.day.getDate())).toEqual([7, 8, 9]);
  });

  it("clips tasks that run past the month edges", () => {
    const agenda = buildMonthAgenda(new Date(2026, 9, 1), [
      task("edge", "2026-09-29T00:00:00", "2026-10-02T00:00:00"),
    ]);

    expect(agenda.map((entry) => entry.day.getDate())).toEqual([1, 2]);
  });
});
