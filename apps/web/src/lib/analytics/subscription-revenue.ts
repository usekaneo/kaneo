import {
  BILLING_PLANS,
  type BillingIntervalKey,
  type BillingPlanKey,
} from "@/constants/billing";

export function subscriptionRevenueUsd(
  plan: BillingPlanKey,
  interval: BillingIntervalKey,
  seats: number,
) {
  const price = BILLING_PLANS.find((entry) => entry.plan === plan)?.amount[
    interval
  ];
  if (price === undefined) return undefined;
  const units = plan === "team" ? Math.max(1, Math.floor(seats) || 1) : 1;
  return price * units;
}
