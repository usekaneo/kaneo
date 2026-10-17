import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  BILLING_PLANS,
  type BillingIntervalKey,
  type BillingPlanKey,
} from "@/constants/billing";
import { useCreateCheckout } from "@/hooks/mutations/billing/use-billing-actions";
import { cn } from "@/lib/cn";
import { BillingIntervalToggle } from "./billing-interval-toggle";
import { PlanCard } from "./plan-card";

type PlanPickerProps = {
  workspaceId: string | undefined;
  canManage: boolean;
  highlighted?: BillingPlanKey;
  highlightLabel?: string;
  compact?: boolean;
};

export function PlanPicker({
  workspaceId,
  canManage,
  highlighted = "team",
  highlightLabel,
  compact = false,
}: PlanPickerProps) {
  const { t } = useTranslation();
  const checkout = useCreateCheckout(workspaceId);
  const [interval, setInterval] = useState<BillingIntervalKey>("annual");

  return (
    <div className="@container space-y-4">
      <BillingIntervalToggle value={interval} onChange={setInterval} />

      <div
        className={cn(
          "grid grid-cols-1 gap-2 @lg:grid-cols-2",
          !compact && "rounded-2xl border border-border/70 bg-card/70 p-2",
        )}
      >
        {BILLING_PLANS.map((plan) => (
          <PlanCard
            key={plan.plan}
            plan={plan}
            interval={interval}
            highlighted={plan.plan === highlighted}
            highlightLabel={highlightLabel ?? t("settings:billing.mostPopular")}
            compact={compact}
            disabled={!canManage || !workspaceId || checkout.isPending}
            isStarting={checkout.isPending}
            onChoose={() => checkout.mutate({ plan: plan.plan, interval })}
          />
        ))}
      </div>

      <p className="text-muted-foreground text-xs">
        {canManage
          ? t("settings:billing.processedBy")
          : t("settings:billing.adminsOnly")}
      </p>
    </div>
  );
}
