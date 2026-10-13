import { TriangleAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { useGetBilling } from "@/hooks/queries/billing/use-get-billing";
import { useOpenWorkspaceBilling } from "@/hooks/use-open-workspace-billing";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { getTrialState } from "@/lib/billing";
import { cn } from "@/lib/cn";

export function TrialExpiredCallout({
  workspaceId,
  className,
}: {
  workspaceId: string;
  className?: string;
}) {
  const { t } = useTranslation();
  const { data: billing } = useGetBilling(workspaceId);
  const { isAdmin } = useWorkspacePermission();
  const billingLink = useOpenWorkspaceBilling(workspaceId);

  if (getTrialState(billing).kind !== "expired") {
    return null;
  }

  return (
    <div
      role="status"
      className={cn(
        "flex flex-col gap-3 rounded-md border border-warning/30 bg-warning/10 p-4 text-warning-foreground sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <TriangleAlert className="mt-0.5 size-4 shrink-0" />
        <div className="space-y-1">
          <p className="font-medium text-sm">
            {t("settings:billing.expiredCallout.title")}
          </p>
          <p className="text-xs opacity-80">
            {isAdmin
              ? t("settings:billing.expiredCallout.adminDescription")
              : t("settings:billing.expiredCallout.memberDescription")}
          </p>
        </div>
      </div>
      {isAdmin ? (
        <Button
          size="sm"
          className="shrink-0"
          disabled={billingLink.isOpening}
          onClick={billingLink.open}
        >
          {t("settings:billing.expiredCallout.action")}
        </Button>
      ) : null}
    </div>
  );
}
