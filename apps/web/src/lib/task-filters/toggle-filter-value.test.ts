import { expect, it } from "vite-plus/test";
import { toggleFilterValue } from "./toggle-filter-value";

it("toggles a value and clears the filter when nothing is left", () => {
  expect(toggleFilterValue(null, "high")).toEqual(["high"]);
  expect(toggleFilterValue(["high", "low"], "high")).toEqual(["low"]);
  expect(toggleFilterValue(["high"], "high")).toBeNull();
});
