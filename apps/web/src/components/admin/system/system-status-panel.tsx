import { RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { Button } from "@/components/ui/button";
import useAdminSystemStatus from "@/hooks/queries/admin/use-admin-system-status";
import { formatDateTime } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EmailSection } from "./email-section";
import { InstanceSection } from "./instance-section";
import { IntegrationsSection } from "./integrations-section";
import { SignInSection } from "./sign-in-section";

function SystemStatusPanel() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isFetching, isError, refetch } =
    useAdminSystemStatus();

  return (
    <SettingsPage
      title={t("settings:adminSystem.title")}
      actions={
        <div className="flex items-center gap-3">
          {data ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("settings:adminSystem.checkedAt", {
                time: formatDateTime(data.checkedAt, i18n.language),
              })}
            </span>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isFetching}
            onClick={() => refetch()}
          >
            <RefreshCwIcon
              aria-hidden="true"
              className={cn(isFetching && "animate-spin")}
            />
            {isFetching
              ? t("settings:adminSystem.refreshing")
              : t("settings:adminSystem.refresh")}
          </Button>
        </div>
      }
    >
      {isError ? (
        <SettingsCard>
          <DirectoryErrorRow
            message={t("settings:adminSystem.loadError")}
            retryLabel={t("settings:adminSystem.retry")}
            onRetry={() => refetch()}
          />
        </SettingsCard>
      ) : null}
      {isLoading ? (
        <SettingsCard aria-busy="true">
          <SettingsRowsSkeleton rows={6} withDescription />
        </SettingsCard>
      ) : null}
      {data ? (
        <>
          <InstanceSection system={data} />
          <EmailSection email={data.email} />
          <SignInSection auth={data.auth} />
          <IntegrationsSection integrations={data.integrations} />
        </>
      ) : null}
    </SettingsPage>
  );
}

export default SystemStatusPanel;
