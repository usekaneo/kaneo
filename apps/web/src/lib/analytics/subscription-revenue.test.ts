import { describe, expect, it } from "vite-plus/test";
import { subscriptionRevenue } from "./subscription-revenue";

describe("subscriptionRevenue", () => {
  it("prices the personal plan as a single seat", () => {
    expect(subscriptionRevenue("personal", "monthly", 3)).toEqual({
      currency: "USD",
      amount: 4,
    });
    expect(subscriptionRevenue("personal", "annual", 1)).toEqual({
      currency: "USD",
      amount: 40,
    });
  });

  it("multiplies the team price by seats", () => {
    expect(subscriptionRevenue("team", "monthly", 6)).toEqual({
      currency: "USD",
      amount: 30,
    });
    expect(subscriptionRevenue("team", "annual", 3)).toEqual({
      currency: "USD",
      amount: 150,
    });
  });

  it("counts at least one team seat", () => {
    expect(subscriptionRevenue("team", "monthly", 0)?.amount).toBe(5);
  });
});
