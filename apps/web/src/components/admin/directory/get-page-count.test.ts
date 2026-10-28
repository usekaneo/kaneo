import { describe, expect, it } from "vite-plus/test";
import { getPageCount } from "./get-page-count";

describe("getPageCount", () => {
  it("never reports fewer than one page", () => {
    expect(getPageCount(0, 20)).toBe(1);
  });

  it("rounds a partial page up", () => {
    expect(getPageCount(20, 20)).toBe(1);
    expect(getPageCount(21, 20)).toBe(2);
    expect(getPageCount(128, 20)).toBe(7);
  });
});
