import { describe, expect, it } from "vite-plus/test";
import { moveKey } from "./move-option";

describe("moveKey", () => {
  const keys = ["a", "b", "c"];

  it("moves a key one step", () => {
    expect(moveKey(keys, "b", "up")).toEqual(["b", "a", "c"]);
    expect(moveKey(keys, "b", "down")).toEqual(["a", "c", "b"]);
  });

  it("returns null at the ends and for unknown keys", () => {
    expect(moveKey(keys, "a", "up")).toBeNull();
    expect(moveKey(keys, "c", "down")).toBeNull();
    expect(moveKey(keys, "z", "down")).toBeNull();
  });

  it("does not change its input", () => {
    moveKey(keys, "a", "down");
    expect(keys).toEqual(["a", "b", "c"]);
  });
});
