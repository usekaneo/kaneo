import { useTranslation } from "react-i18next";
import { StatusBadge } from "@/components/settings/status-badge";
import { formatAiCredit } from "./format-ai-credit";

type AiCreditBalanceRowProps = {
  availableMicroUsd: string;
  reservedMicroUsd: string;
  balanceMicroUsd: string;
  canManage: boolean;
};

export function AiCreditBalanceRow({
  availableMicroUsd,
  reservedMicroUsd,
  balanceMicroUsd,
  canManage,
}: AiCreditBalanceRowProps) {
  const { t, i18n } = useTranslation();
  const money = (value: string) => formatAiCredit(value, i18n.language);
  const depleted = BigInt(availableMicroUsd) <= 0n;
  const reserved = BigInt(reservedMicroUsd) > 0n;

  return (
    <div className="space-y-3 px-4 py-4">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <p className="text-xs text-muted-foreground">
            {t("settings:billing.ai.available")}
          </p>
          <p className="text-2xl font-semibold tracking-tight tabular-nums">
            {money(availableMicroUsd)}
          </p>
        </div>
        {depleted ? (
          <StatusBadge tone="warning">
            {t("settings:billing.ai.pausedBadge")}
          </StatusBadge>
        ) : null}
      </div>
      {reserved ? (
        <p className="text-xs text-muted-foreground tabular-nums">
          {t("settings:billing.ai.reserved", {
            amount: money(reservedMicroUsd),
            balance: money(balanceMicroUsd),
          })}
        </p>
      ) : null}
      {depleted ? (
        <p role="status" className="text-xs text-muted-foreground">
          {canManage
            ? t("settings:billing.ai.depleted")
            : t("settings:billing.ai.depletedMember")}
        </p>
      ) : null}
    </div>
  );
}
