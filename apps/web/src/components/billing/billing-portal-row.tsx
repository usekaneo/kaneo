import { ArrowUpRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useOpenBillingPortal } from "@/hooks/mutations/billing/use-billing-actions";

type BillingPortalRowProps = {
  workspaceId: string | undefined;
  hasCustomer: boolean;
  canManage: boolean;
};

export function BillingPortalRow({
  workspaceId,
  hasCustomer,
  canManage,
}: BillingPortalRowProps) {
  const { t } = useTranslation();
  const portal = useOpenBillingPortal(workspaceId);

  return (
    <div className="flex flex-col items-start gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <p className="text-xs text-muted-foreground">
        {t("settings:billing.portalHint")}
      </p>
      {hasCustomer ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="shrink-0"
          disabled={!canManage || portal.isPending}
          onClick={() => portal.mutate()}
        >
          {portal.isPending
            ? t("settings:billing.opening")
            : t("settings:billing.manage")}
          <ArrowUpRight aria-hidden="true" />
        </Button>
      ) : null}
    </div>
  );
}
