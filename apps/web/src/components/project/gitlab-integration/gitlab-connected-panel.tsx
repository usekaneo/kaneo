import { UnplugIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DisconnectIntegrationButton } from "@/components/project/code-hosting/disconnect-integration-button";
import { WebhookSection } from "@/components/project/code-hosting/webhook-section";
import { GitlabIssuesSection } from "@/components/project/gitlab-integration/gitlab-issues-section";
import { GitlabRepositorySection } from "@/components/project/gitlab-integration/gitlab-repository-section";
import { useSaveGitlabIntegration } from "@/components/project/gitlab-integration/use-save-gitlab-integration";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import { SyncRulesSection } from "@/components/project/sync-rules/sync-rules-section";
import type { GitlabIntegration } from "@/fetchers/gitlab-integration/get-gitlab-integration";
import { useDeleteGitlabIntegration } from "@/hooks/mutations/gitlab-integration/use-create-gitlab-integration";
import { toast } from "@/lib/toast";

type GitlabConnectedPanelProps = {
  projectId: string;
  integration: GitlabIntegration;
};

export function GitlabConnectedPanel({
  projectId,
  integration,
}: GitlabConnectedPanelProps) {
  const { t } = useTranslation();
  const [editingToken, setEditingToken] = useState(false);
  const { save, saving } = useSaveGitlabIntegration(projectId);
  const { mutateAsync: remove, isPending: isDeleting } =
    useDeleteGitlabIntegration();

  const disconnect = async () => {
    try {
      await remove(projectId);
      toast.success(t("settings:gitlabIntegration.toast.removed"), {
        icon: UnplugIcon,
      });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.removeError"),
      );
      return false;
    }
  };

  return (
    <IntegrationPanel>
      <GitlabRepositorySection
        projectId={projectId}
        integration={integration}
        editingToken={editingToken}
        reconnecting={saving}
        onEditingTokenChange={setEditingToken}
        onReconnect={() =>
          void save(
            {
              baseUrl: integration.baseUrl,
              tokenType: integration.tokenType,
              projectPath: integration.projectPath,
            },
            false,
          )
        }
      />
      {integration.webhookUrl ? (
        <WebhookSection
          url={integration.webhookUrl}
          secret={integration.webhookSecret}
          description={t("settings:gitlabIntegration.webhookHint")}
          events={t("settings:gitlabIntegration.webhookEvents")}
        />
      ) : null}
      <GitlabIssuesSection
        projectId={projectId}
        isConnected={Boolean(integration.isActive)}
      />
      <SyncRulesSection
        key={`${projectId}:gitlab`}
        projectId={projectId}
        provider="gitlab"
      />
      <IntegrationPanelFooter>
        <DisconnectIntegrationButton
          provider="GitLab"
          target={integration.projectPath}
          pending={isDeleting || saving}
          onConfirm={disconnect}
        />
      </IntegrationPanelFooter>
    </IntegrationPanel>
  );
}
