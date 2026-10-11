import { describe, expect, it } from "vite-plus/test";
import { assignImportTaskNumbers } from "./assign-import-task-numbers";

const numbered = (...numbers: (number | undefined)[]) =>
  numbers.map((number) => (number === undefined ? {} : { number }));

describe("assignImportTaskNumbers", () => {
  it("keeps source numbers that are all present and unique", () => {
    expect(assignImportTaskNumbers(numbered(12, 3, 7))).toEqual({
      numbers: [12, 3, 7],
      lastNumber: 12,
    });
  });

  it("numbers tasks without a source number after the highest one", () => {
    expect(
      assignImportTaskNumbers(numbered(undefined, 3, undefined, 7)),
    ).toEqual({
      numbers: [8, 3, 9, 7],
      lastNumber: 9,
    });
  });

  it("numbers every task in order when none has a source number", () => {
    expect(assignImportTaskNumbers(numbered(undefined, undefined))).toEqual({
      numbers: [1, 2],
      lastNumber: 2,
    });
  });

  it("keeps the first of duplicate numbers and moves the rest to the end", () => {
    expect(assignImportTaskNumbers(numbered(5, 2, 5, 2, 9))).toEqual({
      numbers: [5, 2, 10, 11, 9],
      lastNumber: 11,
    });
  });

  it("never reuses a kept number for a task numbered later", () => {
    expect(assignImportTaskNumbers(numbered(undefined, 1, 2))).toEqual({
      numbers: [3, 1, 2],
      lastNumber: 3,
    });
  });

  it("replaces zero, negative, fractional and unsafe numbers", () => {
    expect(
      assignImportTaskNumbers(
        numbered(0, -4, 2.5, Number.NaN, Number.MAX_SAFE_INTEGER + 1, 4),
      ),
    ).toEqual({
      numbers: [5, 6, 7, 8, 9, 4],
      lastNumber: 9,
    });
  });

  it("replaces numbers too large to store with room for the rest", () => {
    expect(assignImportTaskNumbers(numbered(2_147_483_647, 1))).toEqual({
      numbers: [2, 1],
      lastNumber: 2,
    });
  });

  it("returns nothing for an empty list", () => {
    expect(assignImportTaskNumbers([])).toEqual({ numbers: [], lastNumber: 0 });
  });
});
