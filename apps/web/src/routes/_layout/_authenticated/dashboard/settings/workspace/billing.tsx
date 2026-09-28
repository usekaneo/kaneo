import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { BillingSectionHeader } from "@/components/billing/billing-section-header";
import { FoundingFreeCard } from "@/components/billing/founding-free-card";
import { PlanPicker } from "@/components/billing/plan-picker";
import { SubscriptionCard } from "@/components/billing/subscription-card";
import { TrialStatusCard } from "@/components/billing/trial-status-card";
import PageTitle from "@/components/page-title";
import { Spinner } from "@/components/ui/spinner";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/billing",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, isAdmin } = useWorkspacePermission();
  const workspaceId = workspace?.id;
  const { data: billing, isLoading } = useGetBilling(workspaceId);

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner />
      </div>
    );
  }

  if (!billing?.billingEnabled) {
    return (
      <>
        <PageTitle title={t("settings:billing.pageTitle")} />
        <div className="mx-auto max-w-4xl space-y-2">
          <h1 className="font-semibold text-2xl">
            {t("settings:billing.pageTitle")}
          </h1>
          <p className="text-muted-foreground text-sm">
            {t("settings:billing.disabled")}
          </p>
        </div>
      </>
    );
  }

  const hasSubscription = Boolean(billing.plan && billing.status);

  return (
    <>
      <PageTitle title={t("settings:billing.pageTitle")} />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">
            {t("settings:billing.pageTitle")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:billing.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          <BillingSectionHeader
            title={t("settings:billing.currentPlan.title")}
            subtitle={t("settings:billing.currentPlan.subtitle")}
          />
          {billing.foundingFree ? (
            <FoundingFreeCard />
          ) : hasSubscription ? (
            <SubscriptionCard
              billing={billing}
              workspaceId={workspaceId}
              canManage={isAdmin}
            />
          ) : (
            <TrialStatusCard billing={billing} />
          )}
        </div>

        {!billing.foundingFree && !hasSubscription ? (
          <div className="space-y-6">
            <BillingSectionHeader
              title={t("settings:billing.choosePlan.title")}
              subtitle={t("settings:billing.choosePlan.subtitle")}
            />
            <PlanPicker workspaceId={workspaceId} canManage={isAdmin} />
          </div>
        ) : null}
      </div>
    </>
  );
}
