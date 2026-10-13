import { ImportIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ImportIssuesSection } from "@/components/project/code-hosting/import-issues-section";
import useImportGitlabIssues from "@/hooks/mutations/gitlab-integration/use-import-gitlab-issues";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type GitlabIssuesSectionProps = {
  projectId: string;
  isConnected: boolean;
};

export function GitlabIssuesSection({
  projectId,
  isConnected,
}: GitlabIssuesSectionProps) {
  const { t } = useTranslation();
  const { canCreateTasks, canUpdateTasks } = useWorkspacePermission();
  const { mutateAsync: importIssues, isPending } = useImportGitlabIssues();
  const hasImportPermission = canCreateTasks() && canUpdateTasks();
  const canImport = hasImportPermission && isConnected;

  const handleImport = async () => {
    if (!canImport) return;
    try {
      await importIssues(projectId);
      toast.success(t("settings:gitlabIntegration.toast.issuesImported"), {
        icon: ImportIcon,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.importError"),
      );
    }
  };

  return (
    <ImportIssuesSection
      description={t("settings:gitlabIntegration.importSectionHint")}
      actionLabel={t("settings:codeHosting.importIssues")}
      pending={isPending}
      disabled={!canImport}
      hint={
        canImport
          ? null
          : hasImportPermission
            ? t("settings:codeHosting.importNeedsReconnect")
            : t("settings:gitlabIntegration.importPermissionHint")
      }
      onImport={handleImport}
    />
  );
}
