import { UnplugIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { isAccessVerified } from "@/components/project/code-hosting/access-verification-tone";
import { DisconnectIntegrationButton } from "@/components/project/code-hosting/disconnect-integration-button";
import { WebhookSection } from "@/components/project/code-hosting/webhook-section";
import { GiteaIssuesSection } from "@/components/project/gitea-integration/gitea-issues-section";
import { GiteaRepositorySection } from "@/components/project/gitea-integration/gitea-repository-section";
import { useGiteaVerification } from "@/components/project/gitea-integration/use-gitea-verification";
import { useSaveGiteaIntegration } from "@/components/project/gitea-integration/use-save-gitea-integration";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import { SyncRulesSection } from "@/components/project/sync-rules/sync-rules-section";
import type { GiteaIntegration } from "@/fetchers/gitea-integration/get-gitea-integration";
import { useDeleteGiteaIntegration } from "@/hooks/mutations/gitea-integration/use-create-gitea-integration";
import { toast } from "@/lib/toast";

type GiteaConnectedPanelProps = {
  projectId: string;
  integration: GiteaIntegration;
};

export function GiteaConnectedPanel({
  projectId,
  integration,
}: GiteaConnectedPanelProps) {
  const { t } = useTranslation();
  const [editingToken, setEditingToken] = useState(false);
  const isConnected = Boolean(integration.isActive);
  const savedAccess = {
    baseUrl: integration.baseUrl,
    repositoryOwner: integration.repositoryOwner,
    repositoryName: integration.repositoryName,
  };
  const status = useGiteaVerification(
    projectId,
    isConnected && !editingToken ? savedAccess : null,
  );
  const { save, saving } = useSaveGiteaIntegration(projectId);
  const { mutateAsync: remove, isPending: isDeleting } =
    useDeleteGiteaIntegration();
  const target = `${integration.repositoryOwner}/${integration.repositoryName}`;

  const disconnect = async () => {
    try {
      await remove(projectId);
      toast.success(t("settings:giteaIntegration.toast.removed"), {
        icon: UnplugIcon,
      });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:giteaIntegration.toast.removeError"),
      );
      return false;
    }
  };

  return (
    <IntegrationPanel>
      <GiteaRepositorySection
        projectId={projectId}
        integration={integration}
        status={status}
        editingToken={editingToken}
        reconnecting={saving}
        onEditingTokenChange={setEditingToken}
        onReconnect={() => void save(savedAccess, false)}
      />
      {integration.webhookUrl ? (
        <WebhookSection
          url={integration.webhookUrl}
          secret={integration.webhookSecret}
          description={t("settings:giteaIntegration.webhookHint")}
          events={t("settings:giteaIntegration.webhookEvents")}
        />
      ) : null}
      <GiteaIssuesSection
        projectId={projectId}
        isConnected={isConnected}
        verified={isAccessVerified(status.result)}
        checking={status.checking}
      />
      <SyncRulesSection
        key={`${projectId}:gitea`}
        projectId={projectId}
        provider="gitea"
      />
      <IntegrationPanelFooter>
        <DisconnectIntegrationButton
          provider="Gitea"
          target={target}
          pending={isDeleting || saving}
          onConfirm={disconnect}
        />
      </IntegrationPanelFooter>
    </IntegrationPanel>
  );
}
