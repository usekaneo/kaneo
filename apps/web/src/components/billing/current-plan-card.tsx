import { BillingPortalRow } from "@/components/billing/billing-portal-row";
import { FoundingFreeRow } from "@/components/billing/founding-free-row";
import { SubscriptionPlanRow } from "@/components/billing/subscription-plan-row";
import { TrialStatusRow } from "@/components/billing/trial-status-row";
import { SettingsCard } from "@/components/settings/settings-card";
import type { GetBillingResponse } from "@/fetchers/billing/get-billing";

type CurrentPlanCardProps = {
  billing: GetBillingResponse;
  workspaceId: string | undefined;
  canManage: boolean;
  onChoosePlan: () => void;
};

export function CurrentPlanCard({
  billing,
  workspaceId,
  canManage,
  onChoosePlan,
}: CurrentPlanCardProps) {
  if (billing.foundingFree) {
    return (
      <SettingsCard>
        <FoundingFreeRow />
      </SettingsCard>
    );
  }

  if (billing.plan && billing.status) {
    return (
      <SettingsCard>
        <SubscriptionPlanRow billing={billing} />
        <BillingPortalRow
          workspaceId={workspaceId}
          hasCustomer={billing.hasCustomer}
          canManage={canManage}
        />
      </SettingsCard>
    );
  }

  return (
    <SettingsCard>
      <TrialStatusRow billing={billing} onChoosePlan={onChoosePlan} />
    </SettingsCard>
  );
}
