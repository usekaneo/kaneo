import { describe, expect, it } from "vitest";
import { moneyToInput, parseMoneyInput } from "./money";

describe("money input", () => {
  it("reads amounts the way people type them", () => {
    expect(parseMoneyInput("40000")).toBe(4_000_000);
    expect(parseMoneyInput("40,000.5")).toBe(4_000_050);
    expect(parseMoneyInput(" 1 250.75 ")).toBe(125_075);
    expect(parseMoneyInput("0.05")).toBe(5);
  });

  it("rejects anything that is not a plain amount", () => {
    expect(parseMoneyInput("")).toBeNull();
    expect(parseMoneyInput("-5")).toBeNull();
    expect(parseMoneyInput("1.234")).toBeNull();
    expect(parseMoneyInput("abc")).toBeNull();
  });

  it("round-trips a stored amount into an input", () => {
    expect(moneyToInput(4_000_000)).toBe("40000");
    expect(moneyToInput(4_000_050)).toBe("40000.50");
  });
});
