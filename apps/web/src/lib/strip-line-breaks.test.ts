import { describe, expect, it } from "vite-plus/test";
import { stripLineBreaks } from "./strip-line-breaks";

describe("stripLineBreaks", () => {
  it("joins lines with a single space", () => {
    expect(stripLineBreaks("Fix the\n  drawer\r\non phones")).toBe(
      "Fix the drawer on phones",
    );
  });

  it("leaves single-line titles untouched", () => {
    expect(stripLineBreaks("  Keep  spacing ")).toBe("  Keep  spacing ");
  });
});
