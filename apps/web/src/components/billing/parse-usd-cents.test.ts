import { describe, expect, it } from "vite-plus/test";
import { parseUsdCents } from "./parse-usd-cents";

describe("parseUsdCents", () => {
  it("reads whole and decimal dollars as exact cents", () => {
    expect(parseUsdCents("5")).toBe(500);
    expect(parseUsdCents("12.34")).toBe(1234);
    expect(parseUsdCents("19.99")).toBe(1999);
    expect(parseUsdCents("0.29")).toBe(29);
    expect(parseUsdCents("4.35")).toBe(435);
    expect(parseUsdCents("1.1")).toBe(110);
    expect(parseUsdCents("7.")).toBe(700);
    expect(parseUsdCents(".5")).toBe(50);
    expect(parseUsdCents(" 20 ")).toBe(2000);
    expect(parseUsdCents("12,50")).toBe(1250);
    expect(parseUsdCents("999999.99")).toBe(99999999);
  });

  it("rejects anything that isn't a plain amount in cents", () => {
    for (const value of [
      "",
      " ",
      ".",
      "1.234",
      "1e3",
      "-5",
      "+5",
      "$5",
      "1,000.00",
      "1.000,00",
      "Infinity",
      "NaN",
      "0x10",
      "5 USD",
      "1".repeat(16),
    ])
      expect(parseUsdCents(value), value).toBeNull();
  });
});
