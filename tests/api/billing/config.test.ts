import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  foundingCutoff,
  isBillingEnabled,
  planForProductId,
  productIdFor,
  trialDays,
} from "../../../apps/api/src/billing/config";

const KEYS = [
  "KANEO_CLOUD",
  "CREEM_API_KEY",
  "CREEM_WEBHOOK_SECRET",
  "CREEM_PRODUCT_PERSONAL_MONTHLY",
  "CREEM_PRODUCT_PERSONAL_ANNUAL",
  "CREEM_PRODUCT_TEAM_MONTHLY",
  "CREEM_PRODUCT_TEAM_ANNUAL",
  "BILLING_TRIAL_DAYS",
  "BILLING_FOUNDING_CUTOFF",
];

let saved: Record<string, string | undefined>;

beforeEach(() => {
  saved = {};
  for (const key of KEYS) {
    saved[key] = process.env[key];
    delete process.env[key];
  }
});

afterEach(() => {
  for (const key of KEYS) {
    if (saved[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = saved[key];
    }
  }
});

describe("billing config", () => {
  it("is disabled unless cloud + both keys are set", () => {
    expect(isBillingEnabled()).toBe(false);

    process.env.KANEO_CLOUD = "true";
    expect(isBillingEnabled()).toBe(false);

    process.env.CREEM_API_KEY = "key";
    expect(isBillingEnabled()).toBe(false);

    process.env.CREEM_WEBHOOK_SECRET = "secret";
    expect(isBillingEnabled()).toBe(true);
  });

  it("stays disabled for self-hosted even with keys present", () => {
    process.env.CREEM_API_KEY = "key";
    process.env.CREEM_WEBHOOK_SECRET = "secret";
    expect(isBillingEnabled()).toBe(false);
  });

  it("maps plan+interval to product id and back", () => {
    process.env.CREEM_PRODUCT_PERSONAL_MONTHLY = "prod_pm";
    process.env.CREEM_PRODUCT_TEAM_ANNUAL = "prod_ta";

    expect(productIdFor("personal", "monthly")).toBe("prod_pm");
    expect(productIdFor("team", "annual")).toBe("prod_ta");
    expect(productIdFor("personal", "annual")).toBeNull();

    expect(planForProductId("prod_pm")).toEqual({
      plan: "personal",
      interval: "monthly",
    });
    expect(planForProductId("prod_ta")).toEqual({
      plan: "team",
      interval: "annual",
    });
    expect(planForProductId("prod_unknown")).toBeNull();
  });

  it("defaults trial to 14 days and reads override", () => {
    expect(trialDays()).toBe(14);
    process.env.BILLING_TRIAL_DAYS = "30";
    expect(trialDays()).toBe(30);
    process.env.BILLING_TRIAL_DAYS = "not-a-number";
    expect(trialDays()).toBe(14);
  });

  it("parses the founding cutoff date, null when unset or invalid", () => {
    expect(foundingCutoff()).toBeNull();
    process.env.BILLING_FOUNDING_CUTOFF = "2026-07-28";
    expect(foundingCutoff()?.getUTCFullYear()).toBe(2026);
    process.env.BILLING_FOUNDING_CUTOFF = "garbage";
    expect(foundingCutoff()).toBeNull();
  });
});
