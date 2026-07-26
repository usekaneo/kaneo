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

  it("normalizes the fallback to two uppercase characters", () => {
    expect(getInitials(null, "na")).toBe("NA");
    expect(getInitials(undefined, "long")).toBe("LO");
  });

  it("keeps initials to two characters when uppercasing expands them", () => {
    expect(getInitials("ßeta")).toBe("SS");
    expect(getInitials("ßeta test")).toBe("ST");
  });
});
