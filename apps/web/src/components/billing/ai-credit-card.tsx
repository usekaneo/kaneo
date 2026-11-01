import { useTranslation } from "react-i18next";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsRow } from "@/components/settings/settings-row";
import { SettingsSection } from "@/components/settings/settings-section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAiCredit } from "@/hooks/queries/billing/use-ai-credit";
import { AiCreditBalanceRow } from "./ai-credit-balance-row";
import { AiCreditHistory } from "./ai-credit-history";
import { AiCreditTopUpRow } from "./ai-credit-top-up-row";

export function AiCreditCard({
  workspaceId,
  canManage,
  checkout,
}: {
  workspaceId: string;
  canManage: boolean;
  checkout?: string;
}) {
  const { t } = useTranslation();
  const credit = useAiCredit(workspaceId);

  return (
    <SettingsSection
      title={t("settings:billing.ai.title")}
      description={t("settings:billing.ai.description")}
    >
      {credit.isPending ? (
        <SettingsCard aria-busy="true">
          <div className="space-y-2 px-4 py-4">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-24" />
          </div>
          <div className="px-4 py-3.5">
            <Skeleton className="h-4 w-40" />
          </div>
        </SettingsCard>
      ) : credit.isError ? (
        <SettingsCard role="alert">
          <SettingsRow title={t("settings:billing.ai.loadError")}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => void credit.refetch()}
            >
              {t("settings:billing.ai.retry")}
            </Button>
          </SettingsRow>
        </SettingsCard>
      ) : !credit.data.enabled ? (
        <SettingsCard>
          <p className="px-4 py-3.5 text-sm text-muted-foreground">
            {t("settings:billing.ai.disabled")}
          </p>
        </SettingsCard>
      ) : (
        <SettingsCard>
          {checkout === "ai-success" ? (
            <p
              role="status"
              className="bg-info/4 px-4 py-3 text-xs text-foreground"
            >
              {t("settings:billing.ai.paymentPending")}
            </p>
          ) : null}
          <AiCreditBalanceRow
            availableMicroUsd={credit.data.availableMicroUsd}
            reservedMicroUsd={credit.data.reservedMicroUsd}
            balanceMicroUsd={credit.data.balanceMicroUsd}
            canManage={canManage}
          />
          {canManage ? (
            <AiCreditTopUpRow
              workspaceId={workspaceId}
              topup={credit.data.topup}
            />
          ) : (
            <p className="px-4 py-3.5 text-xs text-muted-foreground">
              {t("settings:billing.ai.adminOnly")}
            </p>
          )}
          <AiCreditHistory entries={credit.data.entries} />
          <div className="space-y-1 bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
            <p>
              {t("settings:billing.ai.pricing", {
                multiplier: credit.data.multiplierBps / 10000,
              })}
            </p>
            <p>{t("settings:billing.ai.trial")}</p>
          </div>
        </SettingsCard>
      )}
    </SettingsSection>
  );
}
