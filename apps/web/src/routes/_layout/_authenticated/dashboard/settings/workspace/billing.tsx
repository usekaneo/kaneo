import { createFileRoute } from "@tanstack/react-router";
import { ArrowUpRight, Check, Sparkles, TriangleAlert } from "lucide-react";
import { useState } from "react";
import PageTitle from "@/components/page-title";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  useCreateCheckout,
  useOpenBillingPortal,
} from "@/hooks/mutations/billing/use-billing-actions";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { cn } from "@/lib/cn";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/billing",
)({
  component: RouteComponent,
});

type Interval = "monthly" | "annual";
type PlanKey = "personal" | "team";

const PLANS: {
  plan: PlanKey;
  name: string;
  tagline: string;
  monthly: { price: string; suffix: string; note: string };
  annual: { price: string; suffix: string; note: string };
  features: string[];
  highlighted?: boolean;
}[] = [
  {
    plan: "personal",
    name: "Personal",
    tagline: "For individuals",
    monthly: { price: "$4", suffix: "/ month", note: "Billed monthly" },
    annual: {
      price: "$40",
      suffix: "/ year",
      note: "$3.33 / month, billed yearly",
    },
    features: [
      "Single user",
      "Unlimited projects and tasks",
      "Automatic backups and updates",
      "Email support",
    ],
  },
  {
    plan: "team",
    name: "Team",
    tagline: "For teams working together",
    monthly: { price: "$5", suffix: "/ user / month", note: "Billed monthly" },
    annual: {
      price: "$50",
      suffix: "/ user / year",
      note: "$4.17 / user / month, billed yearly",
    },
    features: [
      "Unlimited team members",
      "Unlimited projects and tasks",
      "Workspace roles and permissions",
      "Automatic backups and updates",
      "Priority email support",
    ],
    highlighted: true,
  },
];

const STATUS: Record<
  string,
  { label: string; variant: "success" | "warning" | "error" | "secondary" }
> = {
  active: { label: "Active", variant: "success" },
  trialing: { label: "Trial", variant: "success" },
  past_due: { label: "Payment past due", variant: "warning" },
  scheduled_cancel: { label: "Cancels soon", variant: "warning" },
  canceled: { label: "Canceled", variant: "error" },
  expired: { label: "Expired", variant: "error" },
  paused: { label: "Paused", variant: "secondary" },
};

function formatDate(value: string | null | undefined) {
  if (!value) return null;
  return new Date(value).toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function daysUntil(value: string | null | undefined) {
  if (!value) return null;
  const ms = new Date(value).getTime() - Date.now();
  return Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
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
  const { workspace, isAdmin } = useWorkspacePermission();
  const workspaceId = workspace?.id;
  const canManage = isAdmin;

  const { data: billing, isLoading } = useGetBilling(workspaceId);
  const checkout = useCreateCheckout(workspaceId);
  const portal = useOpenBillingPortal(workspaceId);
  const [interval, setInterval] = useState<Interval>("annual");

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
            Billing isn't enabled on this instance. Self-hosted Kaneo includes
            every feature, free forever.
          </p>
        </div>
      </>
    );
  }

  const hasSubscription = Boolean(billing.plan && billing.status);
  const status = billing.status ? STATUS[billing.status] : null;
  const renews = formatDate(billing.currentPeriodEnd);
  const trialDaysLeft = daysUntil(billing.trialEndsAt);
  const trialExpired =
    !billing.foundingFree && !hasSubscription && trialDaysLeft === 0;

  const pricePer = billing.billingInterval === "annual" ? "year" : "month";
  const planLabel =
    billing.plan === "team"
      ? "Team"
      : billing.plan === "personal"
        ? "Personal"
        : null;

  return (
    <>
      <PageTitle title="Billing" />
      <div className="mx-auto max-w-4xl space-y-8">
        <div className="space-y-2">
          <h1 className="font-semibold text-2xl">Billing</h1>
          <p className="text-muted-foreground">
            Manage the Kaneo Cloud subscription for this workspace.
          </p>
        </div>

        {/* ── Current plan ── */}
        <div className="space-y-6">
          <SectionHeader
            title="Current plan"
            subtitle="Your workspace's active plan and billing status."
          />

          {billing.foundingFree ? (
            <div className="overflow-hidden rounded-md border border-primary/30 bg-sidebar">
              <div className="flex items-start gap-3 p-5">
                <div className="mt-0.5 flex size-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Sparkles className="size-4.5" />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-sm">Founding Free</h3>
                    <Badge variant="success" size="sm">
                      Free
                    </Badge>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    This workspace has free access to Kaneo Cloud as an early
                    supporter. Thank you for being here from the start.
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
                      Kaneo Cloud {planLabel}
                    </h3>
                    {status ? (
                      <Badge variant={status.variant} size="sm">
                        {status.label}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {billing.plan === "team"
                      ? `$${billing.billingInterval === "annual" ? 50 : 5} / user / ${pricePer}`
                      : `$${billing.billingInterval === "annual" ? 40 : 4} / ${pricePer}`}
                    {billing.seats > 1 ? ` · ${billing.seats} seats` : null}
                  </p>
                </div>
                <div className="text-right">
                  {renews ? (
                    <p className="text-muted-foreground text-xs">
                      {billing.canceledAt ? "Access ends" : "Renews"}
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
                  Update payment method, view invoices, or cancel anytime.
                </p>
                {billing.hasCustomer ? (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!canManage || portal.isPending}
                    onClick={() => portal.mutate()}
                  >
                    {portal.isPending ? "Opening…" : "Manage billing"}
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
                    {trialExpired ? "Your trial has ended" : "Free trial"}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {trialExpired
                      ? "Subscribe to a plan below to keep creating and editing. Your data stays safe and exportable in the meantime."
                      : trialDaysLeft !== null
                        ? `You have ${trialDaysLeft} ${trialDaysLeft === 1 ? "day" : "days"} left on your free trial. Choose a plan to continue without interruption.`
                        : "Choose a plan below to continue after your trial."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Plan picker ── */}
        {!billing.foundingFree && !hasSubscription ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <SectionHeader
                title="Choose a plan"
                subtitle="Switch anytime. Cancel whenever you like."
              />
              <div className="inline-flex items-center gap-2">
                <div className="inline-flex rounded-md border border-border bg-sidebar p-0.5 text-xs">
                  {(["monthly", "annual"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setInterval(value)}
                      className={cn(
                        "rounded-[0.3rem] px-3 py-1 font-medium capitalize transition-colors",
                        interval === value
                          ? "bg-background text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
                {interval === "annual" ? (
                  <Badge variant="success" size="sm">
                    2 months free
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-border/70 bg-card/70 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {PLANS.map((p) => {
                  const price = interval === "monthly" ? p.monthly : p.annual;
                  return (
                    <div
                      key={p.plan}
                      className={cn(
                        "flex flex-col rounded-xl border p-6",
                        p.highlighted
                          ? "border-primary/40 bg-card shadow-[0_0_40px_-12px] shadow-primary/20"
                          : "border-border/70 bg-card",
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <h3 className="font-medium text-sm">{p.name}</h3>
                        {p.highlighted ? (
                          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                            Most popular
                          </span>
                        ) : null}
                      </div>
                      <p className="mt-1 text-foreground/60 text-sm">
                        {p.tagline}
                      </p>

                      <div className="mt-6 flex items-baseline gap-1.5">
                        <span className="font-medium text-4xl tracking-tight">
                          {price.price}
                        </span>
                        <span className="text-foreground/60 text-sm">
                          {price.suffix}
                        </span>
                      </div>
                      <p className="mt-1.5 text-foreground/60 text-sm">
                        {price.note}
                      </p>

                      <ul className="mt-8 flex-1 space-y-3 text-sm">
                        {p.features.map((feature) => (
                          <li
                            key={feature}
                            className="flex items-start gap-2.5"
                          >
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                            <span className="text-foreground/90">
                              {feature}
                            </span>
                          </li>
                        ))}
                      </ul>

                      <Button
                        variant={p.highlighted ? "default" : "outline"}
                        className="mt-8 w-full"
                        disabled={!canManage || checkout.isPending}
                        onClick={() =>
                          checkout.mutate({ plan: p.plan, interval })
                        }
                      >
                        {checkout.isPending ? "Starting…" : `Choose ${p.name}`}
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>

            <p className="text-muted-foreground text-xs">
              {canManage
                ? "Payments are securely processed by Creem. Prices exclude tax where applicable."
                : "Only workspace owners and admins can manage billing."}
            </p>
          </div>
        ) : null}
      </div>
    </>
  );
}
