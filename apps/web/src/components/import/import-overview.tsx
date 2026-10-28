import { useTranslation } from "react-i18next";
import { ImportRunHistory } from "@/components/import/import-run-history";
import { ImportSourcePicker } from "@/components/import/import-source-picker";
import { SettingsPage } from "@/components/settings/settings-page";

type ImportOverviewProps = {
  workspaceId: string;
  workspaceName: string;
};

export function ImportOverview({
  workspaceId,
  workspaceName,
}: ImportOverviewProps) {
  const { t } = useTranslation();

  return (
    <SettingsPage
      title={t("settings:workspaceImport.title")}
      description={t("settings:workspaceImport.subtitle", {
        workspace: workspaceName,
      })}
    >
      <ImportSourcePicker />
      <ImportRunHistory workspaceId={workspaceId} />
    </SettingsPage>
  );
}
