import { client } from "@kaneo/libs";

export type BillingPlan = "personal" | "team";
export type BillingInterval = "monthly" | "annual";

export async function createBillingCheckout(input: {
  workspaceId: string;
  plan: BillingPlan;
  interval: BillingInterval;
}) {
  const response = await client.billing[":workspaceId"].checkout.$post({
    param: { workspaceId: input.workspaceId },
    json: { plan: input.plan, interval: input.interval },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}

export async function createBillingPortal(workspaceId: string) {
  const response = await client.billing[":workspaceId"].portal.$post({
    param: { workspaceId },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(error);
  }

  return response.json();
}
