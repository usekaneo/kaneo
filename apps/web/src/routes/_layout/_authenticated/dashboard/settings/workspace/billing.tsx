import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FoundingFreeCard } from "@/components/billing/founding-free-card";
import { PlanPicker } from "@/components/billing/plan-picker";
import { SubscriptionCard } from "@/components/billing/subscription-card";
import { TrialStatusCard } from "@/components/billing/trial-status-card";
import PageTitle from "@/components/page-title";
import { Spinner } from "@/components/ui/spinner";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import { useTrackSubscription } from "@/hooks/use-track-subscription";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsSectionHeader } from "@/components/settings/settings-section-header";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/billing",
)({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>) => ({
    checkout: typeof search.checkout === "string" ? search.checkout : undefined,
  }),
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, isAdmin } = useWorkspacePermission();
  const workspaceId = workspace?.id;
  const { data: billing, isLoading } = useGetBilling(workspaceId);
  const { checkout } = Route.useSearch();
  useTrackSubscription(checkout, billing?.seats);

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
        <SettingsPage
          title={t("settings:billing.pageTitle")}
          description={t("settings:billing.disabled")}
        />
      </>
    );
  }

  const hasSubscription = Boolean(billing.plan && billing.status);

  return (
    <>
      <PageTitle title={t("settings:billing.pageTitle")} />
      <SettingsPage
        title={t("settings:billing.pageTitle")}
        description={t("settings:billing.subtitle")}
      >
        <div className="space-y-3">
          <SettingsSectionHeader
            title={t("settings:billing.currentPlan.title")}
            description={t("settings:billing.currentPlan.subtitle")}
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
          <div className="space-y-3">
            <SettingsSectionHeader
              title={t("settings:billing.choosePlan.title")}
              description={t("settings:billing.choosePlan.subtitle")}
            />
            <PlanPicker workspaceId={workspaceId} canManage={isAdmin} />
          </div>
        ) : null}
      </SettingsPage>
    </>
  );
}
