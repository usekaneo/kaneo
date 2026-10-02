import { describe, expect, it } from "vite-plus/test";
import { subscriptionRevenueUsd } from "./subscription-revenue";

describe("subscriptionRevenueUsd", () => {
  it("prices the personal plan as a single seat", () => {
    expect(subscriptionRevenueUsd("personal", "monthly", 3)).toBe(4);
    expect(subscriptionRevenueUsd("personal", "annual", 1)).toBe(40);
  });

  it("multiplies the team price by seats", () => {
    expect(subscriptionRevenueUsd("team", "monthly", 6)).toBe(30);
    expect(subscriptionRevenueUsd("team", "annual", 3)).toBe(150);
  });

  it("counts at least one team seat", () => {
    expect(subscriptionRevenueUsd("team", "monthly", 0)).toBe(5);
  });
});
