import { describe, expect, it } from "vite-plus/test";
import { descriptionPreview, plainText } from "./description-preview.js";

describe("plainText", () => {
  it("leaves plain text alone", () => {
    expect(plainText("Use <3 and a < b")).toBe("Use <3 and a < b");
  });

  it("turns simple HTML into lines of text", () => {
    expect(plainText("<p>Hello &amp; welcome</p><p>Second<br/>line</p>")).toBe(
      "Hello & welcome\nSecond\nline\n",
    );
  });
});

describe("descriptionPreview", () => {
  it("is empty without a description", () => {
    expect(descriptionPreview(null)).toEqual({ lines: [], more: false });
    expect(descriptionPreview("  \n\n ")).toEqual({ lines: [], more: false });
  });

  it("trims blank edges and collapses repeated blank lines", () => {
    expect(descriptionPreview("\n\nFirst   line\r\n\n\n\nSecond\n\n")).toEqual({
      lines: ["First line", "", "Second"],
      more: false,
    });
  });

  it("keeps the first lines and reports the rest", () => {
    const preview = descriptionPreview("1\n2\n3\n4\n5\n6\n7", 5);
    expect(preview).toEqual({ lines: ["1", "2", "3", "4", "5"], more: true });
  });
});
