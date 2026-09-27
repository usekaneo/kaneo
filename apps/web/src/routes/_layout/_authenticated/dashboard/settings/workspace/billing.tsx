import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Sparkles, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { PlanPicker } from "@/components/billing/plan-picker";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { useOpenBillingPortal } from "@/hooks/mutations/billing/use-billing-actions";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { daysUntil } from "@/lib/billing";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/billing",
)({
  component: RouteComponent,
});

const STATUS_VARIANT: Record<
  string,
  "success" | "warning" | "error" | "secondary"
> = {
  active: "success",
  trialing: "success",
  past_due: "warning",
  scheduled_cancel: "warning",
  canceled: "error",
  expired: "error",
  paused: "secondary",
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function SectionHeader({
  title,
  subtitle,
}: {
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-1">
      <h2 className="font-medium text-md">{title}</h2>
      <p className="text-muted-foreground text-xs">{subtitle}</p>
    </div>
  );
}

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, isAdmin } = useWorkspacePermission();
  const workspaceId = workspace?.id;
  const canManage = isAdmin;

  const { data: billing, isLoading } = useGetBilling(workspaceId);
  const portal = useOpenBillingPortal(workspaceId);

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
  const statusVariant = billing.status
    ? STATUS_VARIANT[billing.status]
    : undefined;
  const renews = formatDate(billing.currentPeriodEnd);
  const trialDaysLeft = daysUntil(billing.trialEndsAt);
  const trialExpired =
    !billing.foundingFree && !hasSubscription && trialDaysLeft === 0;

  const isAnnual = billing.billingInterval === "annual";
  const isTeam = billing.plan === "team";
  const planLabel =
    billing.plan === "team" || billing.plan === "personal"
      ? t(`settings:billing.plans.${billing.plan}.name`)
      : null;
  const price = isTeam ? (isAnnual ? "$50" : "$5") : isAnnual ? "$40" : "$4";
  const priceSuffix = t(
    isTeam
      ? isAnnual
        ? "settings:billing.price.perUserYear"
        : "settings:billing.price.perUserMonth"
      : isAnnual
        ? "settings:billing.price.perYear"
        : "settings:billing.price.perMonth",
  );

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

        {/* ── Current plan ── */}
        <div className="space-y-6">
          <SectionHeader
            title={t("settings:billing.currentPlan.title")}
            subtitle={t("settings:billing.currentPlan.subtitle")}
          />

          {billing.foundingFree ? (
            <div className="overflow-hidden rounded-md border border-primary/30 bg-sidebar">
              <div className="flex items-start gap-3 p-5">
                <div className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Sparkles className="size-4.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">
                      {t("settings:billing.foundingFree.title")}
                    </h3>
                    <Badge variant="success" size="sm">
                      {t("settings:billing.foundingFree.badge")}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {t("settings:billing.foundingFree.description")}
                  </p>
                </div>
              </div>
            </div>
          ) : hasSubscription ? (
            <div className="rounded-md border border-border bg-sidebar">
              <div className="flex flex-wrap items-start justify-between gap-4 p-5">
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">
                      {t("settings:billing.planName", { plan: planLabel })}
                    </h3>
                    {billing.status && statusVariant ? (
                      <Badge variant={statusVariant} size="sm">
                        {t(`settings:billing.status.${billing.status}`)}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {price} {priceSuffix}
                    {billing.seats > 1
                      ? ` · ${t("settings:billing.seats", { count: billing.seats })}`
                      : null}
                  </p>
                </div>
                <div className="text-right">
                  {renews ? (
                    <p className="text-muted-foreground text-xs">
                      {billing.canceledAt
                        ? t("settings:billing.accessEnds")
                        : t("settings:billing.renews")}
                    </p>
                  ) : null}
                  {renews ? (
                    <p className="font-medium text-sm">{renews}</p>
                  ) : null}
                </div>
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
          ) : (
            <div
              className={cn(
                "rounded-md border bg-sidebar p-5",
                trialExpired ? "border-warning/40" : "border-border",
              )}
            >
              <div className="flex items-start gap-3">
                <div
                  className={cn(
                    "mt-0.5 flex size-9 items-center justify-center rounded-md",
                    trialExpired
                      ? "bg-warning/10 text-warning-foreground"
                      : "bg-primary/10 text-primary",
                  )}
                >
                  {trialExpired ? (
                    <TriangleAlert className="size-4.5" />
                  ) : (
                    <Sparkles className="size-4.5" />
                  )}
                </div>
                <div className="space-y-1">
                  <h3 className="font-medium text-sm">
                    {trialExpired
                      ? t("settings:billing.trial.expiredTitle")
                      : t("settings:billing.trial.activeTitle")}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {trialExpired
                      ? t("settings:billing.trial.expiredDescription")
                      : trialDaysLeft !== null
                        ? t("settings:billing.trial.daysLeft", {
                            count: trialDaysLeft,
                          })
                        : t("settings:billing.trial.noDate")}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Plan picker ── */}
        {!billing.foundingFree && !hasSubscription ? (
          <div className="space-y-6">
            <SectionHeader
              title={t("settings:billing.choosePlan.title")}
              subtitle={t("settings:billing.choosePlan.subtitle")}
            />
            <PlanPicker workspaceId={workspaceId} canManage={canManage} />
          </div>
        ) : null}
      </div>
    </>
  );
}
