import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { computeEntitlement } from "../../../apps/api/src/billing/controllers/get-workspace-billing";

type Billing = Parameters<typeof computeEntitlement>[0];

function billing(overrides: Partial<Billing>): Billing {
  return {
    id: "b1",
    workspaceId: "w1",
    foundingFree: false,
    trialEndsAt: null,
    creemCustomerId: null,
    creemSubscriptionId: null,
    creemProductId: null,
    plan: null,
    billingInterval: null,
    status: null,
    seats: 1,
    currentPeriodEnd: null,
    canceledAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Billing;
}

const CLOUD_KEYS = ["KANEO_CLOUD", "CREEM_API_KEY", "CREEM_WEBHOOK_SECRET"];
let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of CLOUD_KEYS) {
    saved[key] = process.env[key];
  }
  process.env.KANEO_CLOUD = "true";
  process.env.CREEM_API_KEY = "key";
  process.env.CREEM_WEBHOOK_SECRET = "secret";
});

afterEach(() => {
  for (const key of CLOUD_KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
});

describe("computeEntitlement", () => {
  it("grants access to everyone when billing is disabled", () => {
    delete process.env.CREEM_API_KEY;
    expect(computeEntitlement(billing({})).active).toBe(true);
    expect(computeEntitlement(billing({})).reason).toBe("billing_disabled");
  });

  it("grants access to founding-free workspaces", () => {
    const result = computeEntitlement(billing({ foundingFree: true }));
    expect(result).toEqual({ active: true, reason: "founding_free" });
  });

  it("grants access for active subscription statuses", () => {
    for (const status of [
      "active",
      "trialing",
      "past_due",
      "scheduled_cancel",
    ]) {
      expect(computeEntitlement(billing({ status })).active).toBe(true);
    }
  });

  it("grants access during an unexpired trial", () => {
    const trialEndsAt = new Date(Date.now() + 60_000);
    expect(computeEntitlement(billing({ trialEndsAt })).reason).toBe("trial");
  });

  it("denies access when trial expired and no subscription", () => {
    const trialEndsAt = new Date(Date.now() - 60_000);
    const result = computeEntitlement(billing({ trialEndsAt }));
    expect(result).toEqual({ active: false, reason: "expired" });
  });

  it("denies access for canceled/expired subscriptions with no paid period left", () => {
    expect(computeEntitlement(billing({ status: "canceled" })).active).toBe(
      false,
    );
    expect(computeEntitlement(billing({ status: "expired" })).active).toBe(
      false,
    );
  });

  it("keeps a canceled subscription entitled until its paid period ends", () => {
    const currentPeriodEnd = new Date(Date.now() + 60_000);

    const result = computeEntitlement(
      billing({ status: "canceled", currentPeriodEnd }),
    );

    expect(result).toEqual({ active: true, reason: "paid_period" });
  });

  it("denies a canceled subscription once the paid period has passed", () => {
    const currentPeriodEnd = new Date(Date.now() - 60_000);

    const result = computeEntitlement(
      billing({ status: "canceled", currentPeriodEnd }),
    );

    expect(result).toEqual({ active: false, reason: "expired" });
  });

  it("does not extend the paid period to expired subscriptions", () => {
    const currentPeriodEnd = new Date(Date.now() + 60_000);

    const result = computeEntitlement(
      billing({ status: "expired", currentPeriodEnd }),
    );

    expect(result.active).toBe(false);
  });

  it("keeps a canceled subscription entitled even after its trial expired", () => {
    const result = computeEntitlement(
      billing({
        status: "canceled",
        currentPeriodEnd: new Date(Date.now() + 60_000),
        trialEndsAt: new Date(Date.now() - 60_000),
      }),
    );
    expect(result).toEqual({ active: true, reason: "paid_period" });
  });
});
