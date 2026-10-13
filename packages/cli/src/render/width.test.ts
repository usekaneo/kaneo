import { describe, expect, it } from "vite-plus/test";
import { padEnd, stringWidth, stripAnsi, truncate } from "./width.js";

describe("stringWidth", () => {
  it("counts plain ascii", () => {
    expect(stringWidth("Fix login")).toBe(9);
  });

  it("ignores SGR and OSC 8 sequences", () => {
    const styled =
      "\u001b[1m\u001b]8;;https://x.test\u001b\\KAN-1\u001b]8;;\u001b\\\u001b[22m";
    expect(stringWidth(styled)).toBe(5);
    expect(stripAnsi(styled)).toBe("KAN-1");
  });

  it("counts wide characters and emoji as two cells", () => {
    expect(stringWidth("日本")).toBe(4);
    expect(stringWidth("🚀 ship")).toBe(7);
  });

  it("counts combining marks as zero", () => {
    expect(stringWidth("é")).toBe(1);
  });
});

describe("truncate", () => {
  it("keeps text that fits", () => {
    expect(truncate("short", 10, "…")).toBe("short");
  });

  it("cuts to the width including the ellipsis", () => {
    const result = truncate("Board performance with 5000 tasks", 12, "…");
    expect(result).toBe("Board perfo…");
    expect(stringWidth(result)).toBe(12);
  });

  it("never splits a wide character", () => {
    expect(
      stringWidth(truncate("日本語のタイトル", 5, "…")),
    ).toBeLessThanOrEqual(5);
  });

  it("uses an ascii ellipsis when asked", () => {
    expect(truncate("abcdefghij", 6, "...")).toBe("abc...");
  });
});

describe("padEnd", () => {
  it("pads by display width", () => {
    expect(padEnd("日本", 6)).toBe("日本  ");
  });
});
