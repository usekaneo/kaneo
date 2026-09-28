import { Check } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import type { BillingIntervalKey, BillingPlan } from "@/constants/billing";
import { getPlanPrice } from "@/lib/billing";
import { cn } from "@/lib/cn";

type PlanCardProps = {
  plan: BillingPlan;
  interval: BillingIntervalKey;
  highlighted: boolean;
  highlightLabel: string;
  compact: boolean;
  disabled: boolean;
  isStarting: boolean;
  onChoose: () => void;
};

export function PlanCard({
  plan,
  interval,
  highlighted,
  highlightLabel,
  compact,
  disabled,
  isStarting,
  onChoose,
}: PlanCardProps) {
  const { t } = useTranslation();
  const name = t(`settings:billing.plans.${plan.plan}.name`);
  const { price, suffixKey, noteKey, notePrice } = getPlanPrice(
    plan.plan,
    interval,
  );

  return (
    <div
      className={cn(
        "flex flex-col rounded-xl border",
        compact ? "p-4" : "p-6",
        highlighted
          ? "border-primary/40 bg-card shadow-[0_0_40px_-12px] shadow-primary/20"
          : "border-border/70 bg-card",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-medium text-sm">{name}</h3>
        {highlighted ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 font-medium text-primary text-xs">
            {highlightLabel}
          </span>
        ) : null}
      </div>
      <p className="mt-1 text-foreground/60 text-sm">
        {t(`settings:billing.plans.${plan.plan}.tagline`)}
      </p>

      <div
        className={cn("flex items-baseline gap-1.5", compact ? "mt-4" : "mt-6")}
      >
        <span
          className={cn(
            "font-medium tracking-tight",
            compact ? "text-3xl" : "text-4xl",
          )}
        >
          {price}
        </span>
        <span className="text-foreground/60 text-sm">{t(suffixKey)}</span>
      </div>
      <p className="mt-1.5 text-foreground/60 text-sm">
        {t(noteKey, { price: notePrice })}
      </p>

      {compact ? null : (
        <ul className="mt-8 flex-1 space-y-3 text-sm">
          {plan.features.map((feature) => (
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
        variant={highlighted ? "default" : "outline"}
        className={cn("w-full", compact ? "mt-4" : "mt-8")}
        disabled={disabled}
        onClick={onChoose}
      >
        {isStarting
          ? t("settings:billing.starting")
          : t("settings:billing.choose", { plan: name })}
      </Button>
    </div>
  );
}
