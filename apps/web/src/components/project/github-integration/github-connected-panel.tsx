import { UnplugIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { DisconnectIntegrationButton } from "@/components/project/code-hosting/disconnect-integration-button";
import { GithubIssuesSection } from "@/components/project/github-integration/github-issues-section";
import { GithubRepositorySection } from "@/components/project/github-integration/github-repository-section";
import { GithubWorkflowHint } from "@/components/project/github-integration/github-workflow-hint";
import { useConnectGithubRepository } from "@/components/project/github-integration/use-connect-github-repository";
import { useGithubVerification } from "@/components/project/github-integration/use-github-verification";
import { IntegrationPanel } from "@/components/project/integrations/panel/integration-panel";
import { IntegrationPanelFooter } from "@/components/project/integrations/panel/integration-panel-footer";
import { SyncRulesSection } from "@/components/project/sync-rules/sync-rules-section";
import type { GitHubAppInfo } from "@/fetchers/github-integration/get-app-info";
import type { GithubIntegration } from "@/fetchers/github-integration/get-github-integration";
import { useDeleteGithubIntegration } from "@/hooks/mutations/github-integration/use-create-github-integration";
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
  const { connect, connecting } = useConnectGithubRepository(projectId);
  const { mutateAsync: remove, isPending: isDeleting } =
    useDeleteGithubIntegration();

  const disconnect = async () => {
    try {
      await remove(projectId);
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
        integration={integration}
        appInfo={appInfo}
        verification={verification.result}
        reconnecting={connecting}
        onReconnect={() => void connect(repository)}
      />
      <GithubIssuesSection projectId={projectId} integration={integration} />
      <SyncRulesSection
        key={`${projectId}:github`}
        projectId={projectId}
        provider="github"
      />
      <IntegrationPanelFooter
        start={<GithubWorkflowHint projectId={projectId} />}
      >
        <DisconnectIntegrationButton
          provider="GitHub"
          target={`${repository.owner}/${repository.name}`}
          pending={isDeleting || connecting}
          onConfirm={disconnect}
        />
      </IntegrationPanelFooter>
    </IntegrationPanel>
  );
}
