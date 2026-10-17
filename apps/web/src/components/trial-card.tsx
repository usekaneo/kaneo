import { Sparkles, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import useActiveWorkspace from "@/hooks/queries/workspace/use-active-workspace";
import { useOpenWorkspaceBilling } from "@/hooks/use-open-workspace-billing";
import { TRIAL_ENDING_DAYS } from "@/constants/billing";
import {
  getTrialState,
  readDismissedTrialCards,
  writeDismissedTrialCards,
} from "@/lib/billing";
import { cn } from "@/lib/cn";

export function TrialCard() {
  const { t } = useTranslation();
  const { data: workspace } = useActiveWorkspace();
  const { data: billing } = useGetBilling(workspace?.id);
  const [dismissed, setDismissed] = useState(readDismissedTrialCards);
  const billingLink = useOpenWorkspaceBilling(workspace?.id);

  const trial = getTrialState(billing);
  if (trial.kind === "none" || !workspace?.id) {
    return null;
  }

  const expired = trial.kind === "expired";
  const ending = expired || trial.daysLeft <= TRIAL_ENDING_DAYS;
  if (!ending && dismissed.includes(workspace.id)) {
    return null;
  }

  const dismiss = () => {
    const next = [...dismissed, workspace.id];
    setDismissed(next);
    writeDismissedTrialCards(next);
  };

  return (
    <div
      className={cn(
        "relative rounded-md border p-2.5 text-xs",
        ending
          ? "border-warning/30 bg-warning/10 text-warning-foreground"
          : "border-info/30 bg-info/10 text-info-foreground",
      )}
    >
      {!ending ? (
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("settings:billing.trialCard.dismiss")}
          className="absolute top-1.5 right-1.5 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
        >
          <X className="size-3" />
        </button>
      ) : null}

      <div className="flex items-center gap-1.5 font-medium">
        {ending ? (
          <TriangleAlert className="size-3.5 shrink-0" />
        ) : (
          <Sparkles className="size-3.5 shrink-0" />
        )}
        <span>
          {expired
            ? t("settings:billing.trialCard.ended")
            : t("settings:billing.trialCard.daysLeft", {
                count: trial.daysLeft,
              })}
        </span>
      </div>
      <p className="mt-1 text-[0.7rem] leading-snug opacity-80">
        {expired
          ? t("settings:billing.trialCard.expiredDescription")
          : ending
            ? t("settings:billing.trialCard.endingDescription")
            : t("settings:billing.trialCard.activeDescription")}
      </p>
      <button
        type="button"
        disabled={billingLink.isOpening}
        onClick={billingLink.open}
        className="mt-2 inline-flex font-medium underline underline-offset-2 hover:no-underline disabled:opacity-60"
      >
        {ending
          ? t("settings:billing.trialCard.choosePlan")
          : t("settings:billing.trialCard.viewPlans")}
      </button>
    </div>
  );
}
