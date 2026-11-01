import { describe, expect, it } from "vite-plus/test";
import { applyMargin, microUsd, pricedMicroUsd } from "./money";

describe("AI credit money", () => {
  it("rounds fractional microdollars once after multiplying token prices", () => {
    expect(microUsd("0.0000001", 1000000n)).toBe(100000n);
    expect(microUsd(1e-7)).toBe(1n);
    expect(microUsd("0.0000000001", 10001n)).toBe(2n);
    expect(microUsd("1.23456789")).toBe(1234568n);
    expect(applyMargin(100001n, 15000)).toBe(150002n);
    expect(microUsd("0")).toBe(0n);
    expect(pricedMicroUsd("0.0000011", 15000)).toBe(2n);
    expect(pricedMicroUsd("0.0000001", 15000)).toBe(1n);
  });
  it.each([-1, Number.NaN, Infinity, "-0.1", "1e999", "1.2.3"])(
    "rejects invalid money %s",
    (value) => {
      expect(() => microUsd(value)).toThrow();
    },
  );
});
