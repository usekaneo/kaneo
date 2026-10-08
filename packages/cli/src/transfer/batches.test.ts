import { describe, expect, it } from "vite-plus/test";
import { batches } from "./batches.js";

describe("batches", () => {
  it("splits a list into chunks of at most the given size", () => {
    expect(batches([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
    expect(batches([], 50)).toEqual([]);
  });
});
