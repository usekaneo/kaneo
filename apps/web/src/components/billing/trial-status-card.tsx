import { Sparkles, TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GetBillingResponse } from "@/fetchers/billing/get-billing";
import { getTrialState } from "@/lib/billing";
import { cn } from "@/lib/cn";

type TrialStatusCardProps = {
  billing: GetBillingResponse;
};

export function TrialStatusCard({ billing }: TrialStatusCardProps) {
  const { t } = useTranslation();
  const trial = getTrialState(billing);
  const expired = trial.kind === "expired";

  const description = expired
    ? t("settings:billing.trial.expiredDescription")
    : trial.kind === "active"
      ? t("settings:billing.trial.daysLeft", { count: trial.daysLeft })
      : t("settings:billing.trial.noDate");

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-card p-5",
        expired ? "border-warning/40" : "border-border",
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "mt-0.5 flex size-9 items-center justify-center rounded-md",
            expired
              ? "bg-warning/10 text-warning-foreground"
              : "bg-primary/10 text-primary",
          )}
        >
          {expired ? (
            <TriangleAlert className="size-4.5" />
          ) : (
            <Sparkles className="size-4.5" />
          )}
        </div>
        <div className="space-y-1">
          <h3 className="font-medium text-sm">
            {expired
              ? t("settings:billing.trial.expiredTitle")
              : t("settings:billing.trial.activeTitle")}
          </h3>
          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
        </div>
      </div>
    </div>
  );
}
