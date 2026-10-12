import { ImportIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ImportIssuesSection } from "@/components/project/code-hosting/import-issues-section";
import useImportGiteaIssues from "@/hooks/mutations/gitea-integration/use-import-gitea-issues";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type GiteaIssuesSectionProps = {
  projectId: string;
  isConnected: boolean;
  verified: boolean;
  checking: boolean;
};

export function GiteaIssuesSection({
  projectId,
  isConnected,
  verified,
  checking,
}: GiteaIssuesSectionProps) {
  const { t } = useTranslation();
  const { canCreateTasks, canUpdateTasks } = useWorkspacePermission();
  const { mutateAsync: importIssues, isPending } = useImportGiteaIssues();
  const hasImportPermission = canCreateTasks() && canUpdateTasks();
  const canImport = hasImportPermission && isConnected && verified;

  const handleImport = async () => {
    if (!canImport) return;
    try {
      await importIssues(projectId);
      toast.success(t("settings:giteaIntegration.toast.issuesImported"), {
        icon: ImportIcon,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:giteaIntegration.toast.importError"),
      );
    }
  };

  return (
    <ImportIssuesSection
      description={t("settings:giteaIntegration.importSectionHint")}
      actionLabel={t("settings:codeHosting.importIssues")}
      pending={isPending}
      disabled={!canImport}
      hint={
        canImport || (checking && hasImportPermission && isConnected)
          ? null
          : !hasImportPermission
            ? t("settings:gitlabIntegration.importPermissionHint")
            : isConnected
              ? t("settings:giteaIntegration.importDisabledHint")
              : t("settings:codeHosting.importNeedsReconnect")
      }
      onImport={handleImport}
    />
  );
}
