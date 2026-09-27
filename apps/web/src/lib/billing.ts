import type { GetBillingResponse } from "@/fetchers/billing/get-billing";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days until `value`, rounded up and floored at zero. */
export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / DAY_MS));
}

export type TrialState =
  | { kind: "none" }
  | { kind: "active"; daysLeft: number; endsAt: string }
  | { kind: "expired" };

/**
 * Where a workspace stands on its trial. `none` covers everything that is not
 * a trial: billing off, founding free, or a subscription of any status.
 */
export function getTrialState(
  billing: GetBillingResponse | undefined,
): TrialState {
  if (!billing?.billingEnabled || billing.foundingFree) return { kind: "none" };
  if (billing.plan && billing.status) return { kind: "none" };
  if (!billing.trialEndsAt) return { kind: "none" };

  const daysLeft = daysUntil(billing.trialEndsAt) ?? 0;
  return daysLeft === 0
    ? { kind: "expired" }
    : { kind: "active", daysLeft, endsAt: billing.trialEndsAt };
}

/** The trial nudge stops being dismissible this many days before the end. */
export const TRIAL_ENDING_DAYS = 3;
