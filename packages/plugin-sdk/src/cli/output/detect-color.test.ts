import { describe, expect, it } from "vite-plus/test";
import { detectColor } from "./detect-color.js";

describe("detectColor", () => {
  it("colors terminals only", () => {
    expect(detectColor({}, true)).toBe(true);
    expect(detectColor({}, false)).toBe(false);
  });

  it("follows NO_COLOR, TERM=dumb and FORCE_COLOR", () => {
    expect(detectColor({ NO_COLOR: "1" }, true)).toBe(false);
    expect(detectColor({ TERM: "dumb" }, true)).toBe(false);
    expect(detectColor({ FORCE_COLOR: "1" }, false)).toBe(true);
    expect(detectColor({ FORCE_COLOR: "0", NO_COLOR: "" }, true)).toBe(false);
  });
});
