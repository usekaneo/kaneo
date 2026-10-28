import { describe, expect, it } from "vite-plus/test";
import { parseDateQuery } from "./parse-date-query";

const now = new Date(2026, 9, 13, 15, 30);
const parse = (query: string) => parseDateQuery(query, now, 1);
const day = (month: number, date: number, year = 2026) =>
  new Date(year, month, date);

describe("parseDateQuery", () => {
  it.each([
    ["today", day(9, 13)],
    ["Tomorrow", day(9, 14)],
    ["tmr", day(9, 14)],
    ["next week", day(9, 19)],
    ["next month", day(10, 13)],
    ["weekend", day(9, 17)],
    ["in 3 days", day(9, 16)],
    ["2w", day(9, 27)],
    ["+1m", day(10, 13)],
    ["fri", day(9, 16)],
    ["next mon", day(9, 19)],
    ["tue", day(9, 20)],
    ["oct 21", day(9, 21)],
    ["21 October", day(9, 21)],
    ["dec 3rd", day(11, 3)],
    ["jan 5", day(0, 5, 2027)],
    ["mar 2 2028", day(2, 2, 2028)],
    ["2026-11-02", day(10, 2)],
  ])("reads %s", (query, expected) => {
    expect(parse(query)).toEqual(expected);
  });

  it("moves a weekday past the earliest allowed day", () => {
    expect(parseDateQuery("fri", now, 1, day(9, 17))).toEqual(day(9, 23));
    expect(parseDateQuery("sat", now, 1, day(9, 17))).toEqual(day(9, 17));
  });

  it.each(["", "t", "soon", "feb 30", "2026-02-31", "ju 4"])(
    "ignores %s",
    (query) => {
      expect(parse(query)).toBeNull();
    },
  );
});
