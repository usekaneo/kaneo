import { User, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { SettingsRow } from "@/components/settings/settings-row";
import { getBillingStatusTone } from "@/components/billing/get-billing-status-tone";
import { StatusBadge } from "@/components/settings/status-badge";
import type { GetBillingResponse } from "@/fetchers/billing/get-billing";
import {
  formatBillingDate,
  getPlanPrice,
  isBillingPlanKey,
} from "@/lib/billing";

type SubscriptionPlanRowProps = {
  billing: GetBillingResponse;
};

export function SubscriptionPlanRow({ billing }: SubscriptionPlanRowProps) {
  const { t } = useTranslation();
  const plan = isBillingPlanKey(billing.plan) ? billing.plan : null;
  const interval = billing.billingInterval === "annual" ? "annual" : "monthly";
  const pricing = plan ? getPlanPrice(plan, interval) : null;
  const renews = formatBillingDate(billing.currentPeriodEnd);
  const seats =
    billing.seats > 1
      ? ` · ${t("settings:billing.seats", { count: billing.seats })}`
      : "";

  return (
    <SettingsRow
      icon={plan === "personal" ? <User /> : <Users />}
      title={plan ? t(`settings:billing.plans.${plan}.name`) : ""}
      badge={
        billing.status ? (
          <StatusBadge tone={getBillingStatusTone(billing.status)}>
            {t(`settings:billing.status.${billing.status}`)}
          </StatusBadge>
        ) : null
      }
      description={
        pricing ? `${pricing.price} ${t(pricing.suffixKey)}${seats}` : null
      }
    >
      {renews ? (
        <div className="sm:text-right">
          <p className="text-xs text-muted-foreground">
            {billing.canceledAt
              ? t("settings:billing.accessEnds")
              : t("settings:billing.renews")}
          </p>
          <p className="text-sm font-medium">{renews}</p>
        </div>
      ) : null}
    </SettingsRow>
  );
}
