const BILLABLE_STATUSES = new Set(["active", "trialing", "past_due"]);

export type SubscriptionState = {
  creemSubscriptionId: string | null;
  status: string | null;
};

export function hasBillableSubscription(
  billing: SubscriptionState | null | undefined,
) {
  if (!billing?.creemSubscriptionId) {
    return false;
  }

  return BILLABLE_STATUSES.has(billing.status ?? "");
}
