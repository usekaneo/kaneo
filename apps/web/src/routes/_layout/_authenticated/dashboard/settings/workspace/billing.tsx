import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import PageTitle from "@/components/page-title";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  useCreateCheckout,
  useOpenBillingPortal,
} from "@/hooks/mutations/billing/use-billing-actions";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/billing",
)({
  component: RouteComponent,
});

type Interval = "monthly" | "annual";

const PLANS = [
  {
    plan: "personal" as const,
    name: "Cloud Personal",
    tagline: "For individuals",
    monthly: "€4 / month",
    annual: "€40 / year",
  },
  {
    plan: "team" as const,
    name: "Cloud Team",
    tagline: "Per user, for teams",
    monthly: "€5 / user / month",
    annual: "€50 / user / year",
  },
];

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  trialing: "Trial",
  past_due: "Payment past due",
  scheduled_cancel: "Cancels at period end",
  canceled: "Canceled",
  expired: "Expired",
  paused: "Paused",
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function RouteComponent() {
  const { workspace, isAdmin } = useWorkspacePermission();
  const workspaceId = workspace?.id;
  const canManage = isAdmin;

  const { data: billing, isLoading } = useGetBilling(workspaceId);
  const checkout = useCreateCheckout(workspaceId);
  const portal = useOpenBillingPortal(workspaceId);
  const [interval, setInterval] = useState<Interval>("monthly");

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
        <PageTitle title="Billing" />
        <div className="mx-auto max-w-4xl space-y-2">
          <h1 className="font-semibold text-2xl">Billing</h1>
          <p className="text-muted-foreground text-sm">
            Billing is not enabled on this instance. Self-hosted Kaneo includes
            every feature for free.
          </p>
        </div>
      </>
    );
  }

  const status = billing.status ? STATUS_LABEL[billing.status] : null;
  const renews = formatDate(billing.currentPeriodEnd);
  const trialEnds = formatDate(billing.trialEndsAt);
  const hasSubscription = Boolean(billing.plan && billing.status);

  return (
    <>
      <PageTitle title="Billing" />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">Billing</h1>
          <p className="text-muted-foreground text-sm">
            Manage the Kaneo Cloud subscription for this workspace.
          </p>
        </div>

        <div className="space-y-4">
          <h2 className="font-medium text-md">Current plan</h2>
          <div className="rounded-lg border border-border p-4">
            {billing.foundingFree ? (
              <p className="text-sm">
                <span className="font-medium">Founding Free.</span> This
                workspace has free access to Kaneo Cloud. Thank you for being an
                early user.
              </p>
            ) : hasSubscription ? (
              <div className="space-y-1 text-sm">
                <p>
                  <span className="font-medium capitalize">
                    {billing.plan} · {billing.billingInterval}
                  </span>
                  {status ? ` · ${status}` : null}
                </p>
                {billing.seats > 1 ? <p>{billing.seats} seats</p> : null}
                {renews ? (
                  <p className="text-muted-foreground">
                    {billing.canceledAt
                      ? `Access ends ${renews}`
                      : `Renews ${renews}`}
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="space-y-1 text-sm">
                <p className="font-medium">Free trial</p>
                <p className="text-muted-foreground">
                  {trialEnds
                    ? `Your trial ends ${trialEnds}. Choose a plan to continue.`
                    : "Choose a plan to continue after your trial."}
                </p>
              </div>
            )}
          </div>

          {billing.hasCustomer ? (
            <Button
              variant="outline"
              size="sm"
              disabled={!canManage || portal.isPending}
              onClick={() => portal.mutate()}
            >
              {portal.isPending ? "Opening…" : "Manage billing & invoices"}
            </Button>
          ) : null}
        </div>

        {!billing.foundingFree && !hasSubscription ? (
          <>
            <Separator />
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-medium text-md">Choose a plan</h2>
                <div className="flex rounded-lg border border-border p-0.5 text-sm">
                  {(["monthly", "annual"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInterval(value)}
                      className={`rounded-md px-3 py-1 capitalize transition-colors ${
                        interval === value
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {PLANS.map((p) => (
                  <div
                    key={p.plan}
                    className="flex flex-col rounded-lg border border-border p-4"
                  >
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-muted-foreground text-sm">{p.tagline}</p>
                    <p className="mt-3 font-medium text-lg">
                      {interval === "monthly" ? p.monthly : p.annual}
                    </p>
                    <Button
                      size="sm"
                      className="mt-4"
                      disabled={!canManage || checkout.isPending}
                      onClick={() =>
                        checkout.mutate({ plan: p.plan, interval })
                      }
                    >
                      {checkout.isPending ? "Starting…" : "Subscribe"}
                    </Button>
                  </div>
                ))}
              </div>

              {!canManage ? (
                <p className="text-muted-foreground text-sm">
                  Only workspace owners and admins can manage billing.
                </p>
              ) : null}
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
