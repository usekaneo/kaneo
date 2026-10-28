import { describe, expect, it } from "vite-plus/test";
import { firstLine, normalizeComment } from "./comment-text.js";

describe("normalizeComment", () => {
  it("drops leading blank lines and trailing whitespace", () => {
    expect(normalizeComment("\n  \nShipped in v2\n\n")).toBe("Shipped in v2");
  });

  it("keeps indentation on the first line and inner blank lines", () => {
    expect(normalizeComment("    code\n\nmore  \n")).toBe("    code\n\nmore");
  });

  it("returns an empty string for whitespace", () => {
    expect(normalizeComment(" \n\t\n ")).toBe("");
  });
});

describe("firstLine", () => {
  it("returns the first non-empty line and whether more follow", () => {
    expect(firstLine("\n  Looks good  \n\nShip it")).toEqual({
      line: "Looks good",
      more: true,
    });
    expect(firstLine("Done")).toEqual({ line: "Done", more: false });
  });
});
