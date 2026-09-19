import { afterEach, describe, expect, it, vi } from "vitest";
import {
  expandedRowsStorageKey,
  readExpandedRows,
  writeExpandedRows,
} from "./expanded-rows-storage";

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

describe("readExpandedRows", () => {
  it("returns an empty map when nothing is stored", () => {
    expect(readExpandedRows("p1")).toEqual({});
  });

  it("round-trips what was written", () => {
    writeExpandedRows("p1", { a: true, "a/b": true });

    expect(readExpandedRows("p1")).toEqual({ a: true, "a/b": true });
  });

  it("keeps projects apart", () => {
    writeExpandedRows("p1", { a: true });

    expect(readExpandedRows("p2")).toEqual({});
  });

  // Each of these would previously have been cast straight to the map, and the
  // first property read during render would throw and blank the list.
  it.each([
    ["null", "null"],
    ["an array", "[1,2,3]"],
    ["a string", '"hello"'],
    ["a number", "42"],
    ["malformed JSON", "{not json"],
  ])("ignores %s", (_label, stored) => {
    localStorage.setItem(expandedRowsStorageKey("p1"), stored);

    expect(readExpandedRows("p1")).toEqual({});
  });

  it("drops non-true values rather than trusting the shape", () => {
    localStorage.setItem(
      expandedRowsStorageKey("p1"),
      JSON.stringify({ a: true, b: false, c: "yes", d: null }),
    );

    expect(readExpandedRows("p1")).toEqual({ a: true });
  });

  it("survives storage that throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    expect(readExpandedRows("p1")).toEqual({});
  });
});

describe("writeExpandedRows", () => {
  it("does not throw when storage refuses", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });

    expect(() => writeExpandedRows("p1", { a: true })).not.toThrow();
  });
});
