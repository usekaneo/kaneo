import { UnplugIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DisconnectIntegrationButton } from "@/components/project/code-hosting/disconnect-integration-button";
import { GithubIssuesSection } from "@/components/project/github-integration/github-issues-section";
import { GithubRepositorySection } from "@/components/project/github-integration/github-repository-section";
import { GithubWorkflowHint } from "@/components/project/github-integration/github-workflow-hint";
import { useGithubVerification } from "@/components/project/github-integration/use-github-verification";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import { SyncRulesSection } from "@/components/project/sync-rules/sync-rules-section";
import type { GitHubAppInfo } from "@/fetchers/github-integration/get-app-info";
import type { GithubIntegration } from "@/fetchers/github-integration/get-github-integrations";
import { useDeleteGithubIntegration } from "@/hooks/mutations/github-integration/use-create-github-integration";
import { useUpdateGithubIntegration } from "@/hooks/mutations/github-integration/use-update-github-integration";
import { toast } from "@/lib/toast";

type GithubConnectedPanelProps = {
  projectId: string;
  integration: GithubIntegration;
  appInfo: GitHubAppInfo | undefined;
};

export function GithubConnectedPanel({
  projectId,
  integration,
  appInfo,
}: GithubConnectedPanelProps) {
  const { t } = useTranslation();
  const repository = {
    owner: integration.repositoryOwner,
    name: integration.repositoryName,
  };
  const verification = useGithubVerification(
    projectId,
    integration.isActive && appInfo?.accountConnected ? repository : null,
  );
  const { mutateAsync: update, isPending: isReconnecting } =
    useUpdateGithubIntegration();
  const { mutateAsync: remove, isPending: isDeleting } =
    useDeleteGithubIntegration();

  const reconnect = async () => {
    try {
      await update({
        projectId,
        integrationId: integration.id,
        json: { isActive: true },
      });
      toast.success(t("settings:githubIntegration.toast.updated"));
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:githubIntegration.toast.updateError"),
      );
    }
  };

  const disconnect = async () => {
    try {
      await remove({ projectId, integrationId: integration.id });
      toast.success(t("settings:githubIntegration.toast.removed"), {
        icon: UnplugIcon,
      });
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : t("settings:githubIntegration.toast.removeError"),
      );
      return false;
    }
  };

  return (
    <IntegrationPanel>
      <GithubRepositorySection
        projectId={projectId}
        integrationId={integration.id}
        integration={integration}
        appInfo={appInfo}
        verification={verification.result}
        reconnecting={isReconnecting}
        onReconnect={() => void reconnect()}
      />
      <GithubIssuesSection projectId={projectId} integration={integration} />
      <SyncRulesSection
        key={integration.id}
        projectId={projectId}
        provider="github"
        integrationId={integration.id}
      />
      <IntegrationPanelFooter
        start={<GithubWorkflowHint projectId={projectId} />}
      >
        <DisconnectIntegrationButton
          provider="GitHub"
          target={`${repository.owner}/${repository.name}`}
          pending={isDeleting || isReconnecting}
          onConfirm={disconnect}
        />
      </IntegrationPanelFooter>
    </IntegrationPanel>
  );
}
