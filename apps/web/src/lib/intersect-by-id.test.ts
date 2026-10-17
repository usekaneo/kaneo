import { describe, expect, it } from "vite-plus/test";
import { intersectById } from "./intersect-by-id";

describe("intersectById", () => {
  it("keeps only items present in every list", () => {
    expect(
      intersectById([
        [{ id: "a" }, { id: "b" }, { id: "c" }],
        [{ id: "b" }, { id: "c" }],
        [{ id: "c" }, { id: "b" }, { id: "d" }],
      ]),
    ).toEqual([{ id: "b" }, { id: "c" }]);
  });

  it("returns the single list unchanged and nothing for no lists", () => {
    expect(intersectById([[{ id: "a" }]])).toEqual([{ id: "a" }]);
    expect(intersectById([])).toEqual([]);
  });
});
