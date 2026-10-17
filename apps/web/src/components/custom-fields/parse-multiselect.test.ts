import { describe, expect, it } from "vite-plus/test";
import { parseMultiselect } from "./parse-multiselect";

describe("parseMultiselect", () => {
  it("reads JSON arrays", () => {
    expect(parseMultiselect('["Web","iOS"]')).toEqual(["Web", "iOS"]);
  });

  it("falls back to comma separated values", () => {
    expect(parseMultiselect("Web, iOS,")).toEqual(["Web", "iOS"]);
  });

  it("returns nothing for empty or non-array input", () => {
    expect(parseMultiselect("")).toEqual([]);
    expect(parseMultiselect(null)).toEqual([]);
    expect(parseMultiselect('{"a":1}')).toEqual([]);
  });
});
