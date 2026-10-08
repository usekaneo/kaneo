import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { BILLING_STATUS_VARIANT } from "@/constants/billing";
import type { GetBillingResponse } from "@/fetchers/billing/get-billing";
import { useOpenBillingPortal } from "@/hooks/mutations/billing/use-billing-actions";
import {
  formatBillingDate,
  getPlanPrice,
  isBillingPlanKey,
} from "@/lib/billing";

type SubscriptionCardProps = {
  billing: GetBillingResponse;
  workspaceId: string | undefined;
  canManage: boolean;
};

export function SubscriptionCard({
  billing,
  workspaceId,
  canManage,
}: SubscriptionCardProps) {
  const { t } = useTranslation();
  const portal = useOpenBillingPortal(workspaceId);

  const plan = isBillingPlanKey(billing.plan) ? billing.plan : null;
  const interval = billing.billingInterval === "annual" ? "annual" : "monthly";
  const pricing = plan ? getPlanPrice(plan, interval) : null;
  const statusVariant = billing.status
    ? BILLING_STATUS_VARIANT[billing.status]
    : undefined;
  const renews = formatBillingDate(billing.currentPeriodEnd);

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex flex-wrap items-start justify-between gap-4 p-5">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-sm">
              {t("settings:billing.planName", {
                plan: plan ? t(`settings:billing.plans.${plan}.name`) : "",
              })}
            </h3>
            {billing.status && statusVariant ? (
              <Badge variant={statusVariant} size="sm">
                {t(`settings:billing.status.${billing.status}`)}
              </Badge>
            ) : null}
          </div>
          {pricing ? (
            <p className="text-muted-foreground text-sm">
              {pricing.price} {t(pricing.suffixKey)}
              {billing.seats > 1
                ? ` · ${t("settings:billing.seats", { count: billing.seats })}`
                : null}
            </p>
          ) : null}
        </div>
        {renews ? (
          <div className="text-right">
            <p className="text-muted-foreground text-xs">
              {billing.canceledAt
                ? t("settings:billing.accessEnds")
                : t("settings:billing.renews")}
            </p>
            <p className="font-medium text-sm">{renews}</p>
          </div>
        ) : null}
      </div>
      <Separator />
      <div className="flex flex-col items-start gap-3 px-5 py-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-muted-foreground text-xs">
          {t("settings:billing.portalHint")}
        </p>
        {billing.hasCustomer ? (
          <Button
            variant="outline"
            size="sm"
            disabled={!canManage || portal.isPending}
            onClick={() => portal.mutate()}
          >
            {portal.isPending
              ? t("settings:billing.opening")
              : t("settings:billing.manage")}
            <ArrowUpRight className="size-4" />
          </Button>
        ) : null}
      </div>
    </div>
  );
}
