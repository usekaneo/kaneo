import { eachDayOfInterval, parseISO } from "date-fns";
import { describe, expect, it } from "vite-plus/test";
import { dragRange } from "./drag-range.js";

const rangeStart = parseISO("2026-09-01");
const days = eachDayOfInterval({
  start: rangeStart,
  end: parseISO("2026-09-10"),
});
const initial = {
  start: parseISO("2026-09-03"),
  end: parseISO("2026-09-05"),
};

describe("dragRange", () => {
  it("moves the start without passing the end", () => {
    expect(dragRange("start", initial, days, rangeStart, -40, 20)).toEqual({
      start: parseISO("2026-09-01"),
      end: initial.end,
    });
    expect(dragRange("start", initial, days, rangeStart, 200, 20)).toEqual({
      start: initial.end,
      end: initial.end,
    });
  });

  it("moves the end within the window without passing the start", () => {
    expect(dragRange("end", initial, days, rangeStart, 60, 20)).toEqual({
      start: initial.start,
      end: parseISO("2026-09-08"),
    });
    expect(dragRange("end", initial, days, rangeStart, 1000, 20).end).toEqual(
      parseISO("2026-09-10"),
    );
    expect(dragRange("end", initial, days, rangeStart, -1000, 20).end).toEqual(
      initial.start,
    );
  });

  it("moves the whole range and keeps its duration inside the window", () => {
    expect(dragRange("move", initial, days, rangeStart, 41, 20)).toEqual({
      start: parseISO("2026-09-05"),
      end: parseISO("2026-09-07"),
    });
    expect(dragRange("move", initial, days, rangeStart, 1000, 20)).toEqual({
      start: parseISO("2026-09-08"),
      end: parseISO("2026-09-10"),
    });
    expect(dragRange("move", initial, days, rangeStart, -1000, 20)).toEqual({
      start: parseISO("2026-09-01"),
      end: parseISO("2026-09-03"),
    });
  });
});
