import { expect, it } from "vite-plus/test";
import { countValues } from "./count-values";

it("counts each value once per item and skips empty values", () => {
  const items = [
    { tags: ["a", "b", "a"] },
    { tags: ["b", null] },
    { tags: [] },
  ];
  expect(countValues(items, (item) => item.tags)).toEqual({ a: 1, b: 2 });
});
