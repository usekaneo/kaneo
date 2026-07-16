import { describe, expect, it } from "vitest";
import { getInitials } from "./get-initials";

describe("getInitials", () => {
  it("returns the first letter of the first two words", () => {
    expect(getInitials("Yiğit Serin")).toBe("YS");
    expect(getInitials("Yiğit Ali Serin")).toBe("YA");
  });

  it("returns the first two characters for a single-word name", () => {
    expect(getInitials("Çağrı")).toBe("ÇA");
  });

  it("normalizes surrounding and repeated whitespace", () => {
    expect(getInitials("  Yiğit   Serin  ")).toBe("YS");
  });

  it("uses the configured fallback when the name is missing", () => {
    expect(getInitials(undefined)).toBe("??");
    expect(getInitials("", "NA")).toBe("NA");
  });
});
