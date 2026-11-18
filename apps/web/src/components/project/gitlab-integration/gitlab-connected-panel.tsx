import { UnplugIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DisconnectIntegrationButton } from "@/components/project/code-hosting/disconnect-integration-button";
import { WebhookSection } from "@/components/project/code-hosting/webhook-section";
import { GitlabIssuesSection } from "@/components/project/gitlab-integration/gitlab-issues-section";
import { GitlabRepositorySection } from "@/components/project/gitlab-integration/gitlab-repository-section";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import { SyncRulesSection } from "@/components/project/sync-rules/sync-rules-section";
import type { GitlabIntegration } from "@/fetchers/gitlab-integration/get-gitlab-integrations";
import { useDeleteGitlabIntegration } from "@/hooks/mutations/gitlab-integration/use-create-gitlab-integration";
import { useUpdateGitlabIntegration } from "@/hooks/mutations/gitlab-integration/use-update-gitlab-integration";
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
  const { mutateAsync: update, isPending: isReconnecting } =
    useUpdateGitlabIntegration();
  const { mutateAsync: remove, isPending: isDeleting } =
    useDeleteGitlabIntegration();

  const reconnect = async () => {
    try {
      await update({
        projectId,
        integrationId: integration.id,
        json: { isActive: true },
      });
      toast.success(t("settings:gitlabIntegration.toast.updated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:gitlabIntegration.toast.updateError"),
      );
    }
  };

  const disconnect = async () => {
    try {
      await remove({ projectId, integrationId: integration.id });
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
        integrationId={integration.id}
        integration={integration}
        editingToken={editingToken}
        reconnecting={isReconnecting}
        onEditingTokenChange={setEditingToken}
        onReconnect={() => void reconnect()}
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
        integrationId={integration.id}
        isConnected={Boolean(integration.isActive)}
      />
      <SyncRulesSection
        key={integration.id}
        projectId={projectId}
        provider="gitlab"
        integrationId={integration.id}
      />
      <IntegrationPanelFooter>
        <DisconnectIntegrationButton
          provider="GitLab"
          target={integration.projectPath}
          pending={isDeleting || isReconnecting}
          onConfirm={disconnect}
        />
      </IntegrationPanelFooter>
    </IntegrationPanel>
  );
}
