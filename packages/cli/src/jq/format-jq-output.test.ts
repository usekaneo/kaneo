import { describe, expect, it } from "vite-plus/test";
import { formatJqResults } from "./format-jq-output.js";

describe("formatJqResults", () => {
  it("prints strings without quotes, one result per line", () => {
    expect(formatJqResults(["KAN-1", "Fix login"])).toBe("KAN-1\nFix login\n");
  });

  it("prints other values as compact JSON", () => {
    expect(formatJqResults([3, true, null, { id: "a" }, ["x"]])).toBe(
      '3\ntrue\nnull\n{"id":"a"}\n["x"]\n',
    );
  });

  it("prints nothing when the expression yields no results", () => {
    expect(formatJqResults([])).toBe("");
  });

  it("strips terminal control characters from string results", () => {
    expect(formatJqResults(["title\u001b]0;pwned\u0007"])).toBe(
      "title]0;pwned\n",
    );
  });
});
