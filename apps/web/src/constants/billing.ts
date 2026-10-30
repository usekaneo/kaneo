export type BillingPlanKey = "personal" | "team";
export type BillingIntervalKey = "monthly" | "annual";
export type BillingStatusVariant =
  | "success"
  | "warning"
  | "error"
  | "secondary";

export type BillingPlan = {
  plan: BillingPlanKey;
  monthly: string;
  annual: string;
  annualPerMonth: string;
  amount: Record<BillingIntervalKey, number>;
  features: string[];
};

export const BILLING_PLANS: BillingPlan[] = [
  {
    plan: "personal",
    monthly: "$4",
    annual: "$40",
    annualPerMonth: "$3.33",
    amount: { monthly: 4, annual: 40 },
    features: ["singleUser", "unlimitedProjects", "backups", "emailSupport"],
  },
  {
    plan: "team",
    monthly: "$5",
    annual: "$50",
    annualPerMonth: "$4.17",
    amount: { monthly: 5, annual: 50 },
    features: [
      "unlimitedMembers",
      "unlimitedProjects",
      "roles",
      "backups",
      "prioritySupport",
    ],
  },
];

export const BILLING_INTERVALS: BillingIntervalKey[] = ["monthly", "annual"];

export const BILLING_STATUS_VARIANT: Record<string, BillingStatusVariant> = {
  active: "success",
  trialing: "success",
  past_due: "warning",
  scheduled_cancel: "warning",
  canceled: "error",
  expired: "error",
  paused: "secondary",
};

export const TRIAL_ENDING_DAYS = 3;

export const TRIAL_CARD_DISMISS_KEY = "kaneo:trial-card-dismissed";
