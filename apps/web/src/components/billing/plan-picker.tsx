import { Check } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useCreateCheckout } from "@/hooks/mutations/billing/use-billing-actions";
import { cn } from "@/lib/cn";

export type BillingPlanKey = "personal" | "team";
type Interval = "monthly" | "annual";

const PLANS: {
  plan: BillingPlanKey;
  monthly: string;
  annual: string;
  annualPerMonth: string;
  features: string[];
}[] = [
  {
    plan: "personal",
    monthly: "$4",
    annual: "$40",
    annualPerMonth: "$3.33",
    features: ["singleUser", "unlimitedProjects", "backups", "emailSupport"],
  },
  {
    plan: "team",
    monthly: "$5",
    annual: "$50",
    annualPerMonth: "$4.17",
    features: [
      "unlimitedMembers",
      "unlimitedProjects",
      "roles",
      "backups",
      "prioritySupport",
    ],
  },
];

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
  const [interval, setInterval] = useState<Interval>("annual");

  return (
    <div className="@container space-y-4">
      <div className="inline-flex items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-sidebar p-0.5 text-xs">
          {(["monthly", "annual"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={interval === value}
              onClick={() => setInterval(value)}
              className={cn(
                "rounded-[0.3rem] px-3 py-1 font-medium transition-colors",
                interval === value
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(`settings:billing.interval.${value}`)}
            </button>
          ))}
        </div>
        {interval === "annual" ? (
          <Badge variant="success" size="sm">
            {t("settings:billing.interval.annualBadge")}
          </Badge>
        ) : null}
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-2 @lg:grid-cols-2",
          !compact && "rounded-2xl border border-border/70 bg-card/70 p-2",
        )}
      >
        {PLANS.map((p) => {
          const isHighlighted = p.plan === highlighted;
          const isTeam = p.plan === "team";
          const name = t(`settings:billing.plans.${p.plan}.name`);
          const price = interval === "monthly" ? p.monthly : p.annual;
          const suffix =
            interval === "monthly"
              ? t(
                  isTeam
                    ? "settings:billing.price.perUserMonth"
                    : "settings:billing.price.perMonth",
                )
              : t(
                  isTeam
                    ? "settings:billing.price.perUserYear"
                    : "settings:billing.price.perYear",
                );
          const note =
            interval === "monthly"
              ? t("settings:billing.price.billedMonthly")
              : t(
                  isTeam
                    ? "settings:billing.price.billedYearlyPerUser"
                    : "settings:billing.price.billedYearly",
                  { price: p.annualPerMonth },
                );

          return (
            <div
              key={p.plan}
              className={cn(
                "flex flex-col rounded-xl border",
                compact ? "p-4" : "p-6",
                isHighlighted
                  ? "border-primary/40 bg-card shadow-[0_0_40px_-12px] shadow-primary/20"
                  : "border-border/70 bg-card",
              )}
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-medium text-sm">{name}</h3>
                {isHighlighted ? (
                  <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
                    {highlightLabel ?? t("settings:billing.mostPopular")}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-foreground/60 text-sm">
                {t(`settings:billing.plans.${p.plan}.tagline`)}
              </p>

              <div
                className={cn(
                  "flex items-baseline gap-1.5",
                  compact ? "mt-4" : "mt-6",
                )}
              >
                <span
                  className={cn(
                    "font-medium tracking-tight",
                    compact ? "text-3xl" : "text-4xl",
                  )}
                >
                  {price}
                </span>
                <span className="text-foreground/60 text-sm">{suffix}</span>
              </div>
              <p className="mt-1.5 text-foreground/60 text-sm">{note}</p>

              {compact ? null : (
                <ul className="mt-8 flex-1 space-y-3 text-sm">
                  {p.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span className="text-foreground/90">
                        {t(`settings:billing.features.${feature}`)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              <Button
                type="button"
                variant={isHighlighted ? "default" : "outline"}
                className={cn("w-full", compact ? "mt-4" : "mt-8")}
                disabled={!canManage || !workspaceId || checkout.isPending}
                onClick={() => checkout.mutate({ plan: p.plan, interval })}
              >
                {checkout.isPending
                  ? t("settings:billing.starting")
                  : t("settings:billing.choose", { plan: name })}
              </Button>
            </div>
          );
        })}
      </div>

      <p className="text-muted-foreground text-xs">
        {canManage
          ? t("settings:billing.processedBy")
          : t("settings:billing.adminsOnly")}
      </p>
    </div>
  );
}
