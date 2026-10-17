import { Result } from "effect";
import { describe, expect, it } from "vite-plus/test";
import { parseColor } from "./parse-color.js";

const color = (input: string) => {
  const result = parseColor(input);
  return Result.isSuccess(result) ? result.success : "invalid";
};

describe("parseColor", () => {
  it("normalizes hex colors", () => {
    expect(color("#3B82F6")).toBe("#3b82f6");
    expect(color("3b82f6")).toBe("#3b82f6");
    expect(color("#abc")).toBe("#aabbcc");
  });

  it("clears with none and rejects other words", () => {
    expect(color("none")).toBeNull();
    expect(color("blue")).toBe("invalid");
    expect(color("#12345")).toBe("invalid");
  });
});
