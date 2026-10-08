import type { BillingIntervalKey, BillingPlanKey } from "@/constants/billing";

const KEY = "kaneo:pending-purchase";
const PLANS = new Set<string>(["personal", "team"]);
const INTERVALS = new Set<string>(["monthly", "annual"]);

export type PendingPurchase = {
  plan: BillingPlanKey;
  interval: BillingIntervalKey;
};

export function savePendingPurchase(purchase: PendingPurchase) {
  try {
    sessionStorage.setItem(KEY, `${purchase.plan}-${purchase.interval}`);
  } catch {}
}

export function takePendingPurchase(): PendingPurchase | null {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    const [plan, interval] = value?.split("-") ?? [];
    if (!PLANS.has(plan) || !INTERVALS.has(interval)) return null;
    return {
      plan: plan as BillingPlanKey,
      interval: interval as BillingIntervalKey,
    };
  } catch {
    return null;
  }
}
