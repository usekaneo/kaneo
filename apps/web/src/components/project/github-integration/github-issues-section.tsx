import { ImportIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ImportIssuesSection } from "@/components/project/code-hosting/import-issues-section";
import type { GithubIntegration } from "@/fetchers/github-integration/get-github-integration";
import useImportGithubIssues from "@/hooks/mutations/github-integration/use-import-github-issues";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { toast } from "@/lib/toast";

type GithubIssuesSectionProps = {
  projectId: string;
  integration: GithubIntegration;
};

export function GithubIssuesSection({
  projectId,
  integration,
}: GithubIssuesSectionProps) {
  const { t } = useTranslation();
  const { canCreateTasks, canUpdateTasks } = useWorkspacePermission();
  const { mutateAsync: importIssues, isPending } = useImportGithubIssues();
  const hasImportPermission = canCreateTasks() && canUpdateTasks();
  const canImport =
    hasImportPermission &&
    Boolean(integration.isActive) &&
    !integration.requiresVerification;
  const progress = integration.importProgress;

  const handleImport = async () => {
    if (!hasImportPermission) return;
    try {
      const result = await importIssues({
        projectId,
        ...(progress?.pending ? { runId: progress.runId } : {}),
      });
      toast.success(t("settings:githubIntegration.toast.issuesImported"), {
        icon: ImportIcon,
        description: t("settings:githubIntegration.importSummary", result),
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:githubIntegration.toast.importError"),
      );
    }
  };

  const description = progress
    ? progress.pending && !isPending
      ? `${t("settings:githubIntegration.importPaused")} ${t("settings:codeHosting.lastImport", progress)}`
      : t("settings:codeHosting.lastImport", progress)
    : t("settings:githubIntegration.importSectionHint");

  return (
    <ImportIssuesSection
      description={description}
      actionLabel={
        progress?.pending
          ? t("settings:githubIntegration.resumeImport")
          : t("settings:codeHosting.importIssues")
      }
      pending={isPending}
      disabled={!canImport}
      hint={
        canImport
          ? null
          : hasImportPermission
            ? t("settings:githubIntegration.importDisabledHint")
            : t("settings:gitlabIntegration.importPermissionHint")
      }
      onImport={handleImport}
    />
  );
}
