import { RefreshCwIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import { Button } from "@/components/ui/button";
import useAdminOverview from "@/hooks/queries/admin/use-admin-overview";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import { OverviewServices } from "./overview-services";
import { OverviewStats } from "./overview-stats";
import { OverviewWarnings } from "./overview-warnings";
import { RecentActions } from "./recent-actions";
import { RecentUsers } from "./recent-users";

export default function AdminOverviewPanel() {
  const { t, i18n } = useTranslation();
  const { data, isLoading, isFetching, isError, refetch } = useAdminOverview();
  return (
    <SettingsPage
      title={t("settings:adminOverview.title")}
      actions={
        <div className="flex items-center gap-3">
          {data ? (
            <span className="text-xs text-muted-foreground tabular-nums">
              {t("settings:adminSystem.checkedAt", {
                time: formatDateTime(data.services.checkedAt, i18n.language),
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
            message={t("settings:adminOverview.loadError")}
            retryLabel={t("settings:adminSystem.retry")}
            onRetry={() => refetch()}
          />
        </SettingsCard>
      ) : null}
      {isLoading ? (
        <SettingsCard aria-busy="true">
          <SettingsRowsSkeleton rows={5} />
        </SettingsCard>
      ) : null}
      {data ? (
        <>
          <OverviewStats data={data} />
          <OverviewWarnings warnings={data.warnings} />
          <OverviewServices services={data.services} />
          <RecentUsers users={data.recentUsers} />
          <RecentActions actions={data.recentActions} />
        </>
      ) : null}
    </SettingsPage>
  );
}
