import { describe, expect, it } from "vite-plus/test";
import { filterByName } from "./filter-by-name";

describe("filterByName", () => {
  const items = [{ name: "acme/Website" }, { name: "acme/api" }];

  it("matches case-insensitively and returns everything for a blank term", () => {
    expect(filterByName(items, " WEB ", (item) => item.name)).toEqual([
      { name: "acme/Website" },
    ]);
    expect(filterByName(items, "  ", (item) => item.name)).toBe(items);
  });
});
