import { useTranslation } from "react-i18next";
import { PlanPicker } from "@/components/billing/plan-picker";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { WorkspaceUsage } from "@/constants/onboarding";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import {
  formatBillingDate,
  getTrialState,
  recommendedPlanFor,
} from "@/lib/billing";

type PlanStepProps = {
  workspaceId: string;
  usage: WorkspaceUsage;
  onContinue: () => void;
};

export function PlanStep({ workspaceId, usage, onContinue }: PlanStepProps) {
  const { t } = useTranslation();
  const { data: billing, isPending } = useGetBilling(workspaceId);

  if (isPending) {
    return <Spinner className="mx-auto h-6 w-6 text-muted-foreground" />;
  }

  const trial = getTrialState(billing);
  const onTrial = trial.kind === "active";

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {onTrial
          ? t("auth:onboarding.cloud.plan.trialActive", {
              date: formatBillingDate(trial.endsAt, {
                month: "long",
                day: "numeric",
              }),
            })
          : t("auth:onboarding.cloud.plan.trialUsed")}
      </p>

      <PlanPicker
        workspaceId={workspaceId}
        canManage
        highlighted={recommendedPlanFor(usage)}
        highlightLabel={t("auth:onboarding.cloud.plan.recommended")}
        compact
      />

      <div className="space-y-2">
        <Button
          type="button"
          variant={onTrial ? "secondary" : "ghost"}
          className="w-full"
          onClick={onContinue}
        >
          {onTrial
            ? t("auth:onboarding.cloud.plan.continueTrial")
            : t("auth:onboarding.cloud.plan.continueWithoutPlan")}
        </Button>
        <p className="text-center text-xs text-muted-foreground">
          {t("auth:onboarding.cloud.plan.note")}
        </p>
      </div>
    </div>
  );
}
