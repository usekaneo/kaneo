import {
  BILLING_PLANS,
  type BillingIntervalKey,
  type BillingPlanKey,
  TRIAL_CARD_DISMISS_KEY,
} from "@/constants/billing";
import type { WorkspaceUsage } from "@/constants/onboarding";
import type { GetBillingResponse } from "@/fetchers/billing/get-billing";
import { formatDate } from "@/lib/format";

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / DAY_MS));
}

export function formatBillingDate(
  value: string | null | undefined,
  options: Intl.DateTimeFormatOptions = {
    year: "numeric",
    month: "long",
    day: "numeric",
  },
) {
  if (!value) return null;
  return formatDate(value, options);
}

export type TrialState =
  | { kind: "none" }
  | { kind: "active"; daysLeft: number; endsAt: string }
  | { kind: "expired" };

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

export function isBillingPlanKey(value: unknown): value is BillingPlanKey {
  return value === "personal" || value === "team";
}

export function getPlanPrice(
  plan: BillingPlanKey,
  interval: BillingIntervalKey,
) {
  const definition = BILLING_PLANS.find((p) => p.plan === plan);
  if (!definition) throw new Error(`Unknown billing plan: ${plan}`);

  const isTeam = plan === "team";
  const isAnnual = interval === "annual";

  return {
    price: isAnnual ? definition.annual : definition.monthly,
    suffixKey: isTeam
      ? isAnnual
        ? "settings:billing.price.perUserYear"
        : "settings:billing.price.perUserMonth"
      : isAnnual
        ? "settings:billing.price.perYear"
        : "settings:billing.price.perMonth",
    noteKey: isAnnual
      ? isTeam
        ? "settings:billing.price.billedYearlyPerUser"
        : "settings:billing.price.billedYearly"
      : "settings:billing.price.billedMonthly",
    notePrice: definition.annualPerMonth,
  };
}

export function recommendedPlanFor(usage: WorkspaceUsage): BillingPlanKey {
  return usage === "solo" ? "personal" : "team";
}

export function readDismissedTrialCards(): string[] {
  try {
    const value = JSON.parse(
      localStorage.getItem(TRIAL_CARD_DISMISS_KEY) ?? "[]",
    );
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function writeDismissedTrialCards(workspaceIds: string[]) {
  try {
    localStorage.setItem(TRIAL_CARD_DISMISS_KEY, JSON.stringify(workspaceIds));
  } catch {}
}
