import { useTranslation } from "react-i18next";
import { DirectoryErrorRow } from "@/components/admin/directory/directory-error-row";
import { SettingsCard } from "@/components/settings/settings-card";
import { SettingsPage } from "@/components/settings/settings-page";
import { SettingsRowsSkeleton } from "@/components/settings/settings-rows-skeleton";
import useUpdateAdminSettings from "@/hooks/mutations/admin/use-update-admin-settings";
import useAdminSettings from "@/hooks/queries/admin/use-admin-settings";
import { GeneralSection } from "./general-section";
import { IntegrationsSection } from "./integrations-section";
import { RegistrationSection } from "./registration-section";
import { WorkspacesSection } from "./workspaces-section";

function InstanceSettingsPanel() {
  const { t } = useTranslation();
  const { data: settings, isLoading, isError, refetch } = useAdminSettings();
  const update = useUpdateAdminSettings();
  const sectionProps = settings
    ? { settings, pending: update.isPending, onChange: update.mutate }
    : null;

  return (
    <SettingsPage title={t("settings:adminSettings.title")}>
      {isError ? (
        <SettingsCard>
          <DirectoryErrorRow
            message={t("settings:adminSettings.loadError")}
            retryLabel={t("settings:adminUsers.retry")}
            onRetry={() => refetch()}
          />
        </SettingsCard>
      ) : null}
      {isLoading ? (
        <SettingsCard aria-busy="true">
          <SettingsRowsSkeleton rows={5} />
        </SettingsCard>
      ) : null}
      {sectionProps ? (
        <>
          <GeneralSection {...sectionProps} />
          <RegistrationSection {...sectionProps} />
          <WorkspacesSection {...sectionProps} />
          <IntegrationsSection {...sectionProps} />
        </>
      ) : null}
    </SettingsPage>
  );
}

export default InstanceSettingsPanel;
