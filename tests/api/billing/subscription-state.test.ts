import { describe, expect, it } from "vitest";
import { hasBillableSubscription } from "../../../apps/api/src/billing/subscription-state";

describe("hasBillableSubscription", () => {
  it("is false without a subscription id", () => {
    expect(
      hasBillableSubscription({ creemSubscriptionId: null, status: "active" }),
    ).toBe(false);
    expect(hasBillableSubscription(null)).toBe(false);
    expect(hasBillableSubscription(undefined)).toBe(false);
  });

  it("is true while the subscription can still charge", () => {
    for (const status of ["active", "trialing", "past_due"]) {
      expect(
        hasBillableSubscription({ creemSubscriptionId: "sub_1", status }),
      ).toBe(true);
    }
  });

  it("is false once the subscription is winding down", () => {
    for (const status of ["scheduled_cancel", "canceled", "expired", null]) {
      expect(
        hasBillableSubscription({ creemSubscriptionId: "sub_1", status }),
      ).toBe(false);
    }
  });
});
