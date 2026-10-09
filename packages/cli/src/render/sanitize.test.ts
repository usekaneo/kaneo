import { describe, expect, it } from "vite-plus/test";
import { isSafeUrl, sanitizeDeep, sanitizeText } from "./sanitize.js";

const ESC = "\u001b";

describe("sanitizeText", () => {
  it("removes escape sequences and other control characters", () => {
    expect(sanitizeText(`Fix ${ESC}[2J${ESC}]0;pwned\u0007login`)).toBe(
      "Fix [2J]0;pwnedlogin",
    );
    expect(sanitizeText("a\u009bb\u007fc")).toBe("abc");
  });

  it("keeps tabs and line breaks, normalizing carriage returns", () => {
    expect(sanitizeText("one\ttwo\r\nthree\rfour")).toBe(
      "one\ttwo\nthree\nfour",
    );
  });

  it("keeps ordinary Unicode", () => {
    expect(sanitizeText("Café 日本 🚀")).toBe("Café 日本 🚀");
  });
});

describe("sanitizeDeep", () => {
  it("cleans every string in nested data and leaves other values alone", () => {
    expect(
      sanitizeDeep({
        title: `x${ESC}[31m`,
        tags: [`a${ESC}`],
        count: 2,
        ok: true,
        none: null,
      }),
    ).toEqual({ title: "x[31m", tags: ["a"], count: 2, ok: true, none: null });
  });
});

describe("isSafeUrl", () => {
  it("accepts plain http and https URLs only", () => {
    expect(isSafeUrl("https://cloud.kaneo.app/dashboard?x=1&y=2")).toBe(true);
    expect(isSafeUrl("http://localhost:1337/device")).toBe(true);
    expect(isSafeUrl(`https://x.test/${ESC}]8;;evil`)).toBe(false);
    expect(isSafeUrl("https://x.test/a b")).toBe(false);
    expect(isSafeUrl("file:///etc/passwd")).toBe(false);
    expect(isSafeUrl("javascript:alert(1)")).toBe(false);
  });
});
