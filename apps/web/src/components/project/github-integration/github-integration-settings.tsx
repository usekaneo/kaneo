import { CodeHostingLoadError } from "@/components/project/code-hosting/code-hosting-load-error";
import { CodeHostingPanelSkeleton } from "@/components/project/code-hosting/code-hosting-panel-skeleton";
import { GithubConnectedPanel } from "@/components/project/github-integration/github-connected-panel";
import { GithubSetupPanel } from "@/components/project/github-integration/github-setup-panel";
import { useGithubAppInfo } from "@/components/project/github-integration/use-github-app-info";
import useGetGithubIntegration from "@/hooks/queries/github-integration/use-get-github-integration";

type GitHubIntegrationSettingsProps = {
  projectId: string;
};

export function GitHubIntegrationSettings({
  projectId,
}: GitHubIntegrationSettingsProps) {
  const {
    data: integration,
    isLoading,
    error,
    refetch,
  } = useGetGithubIntegration(projectId);
  const { data: appInfo } = useGithubAppInfo();

  if (isLoading) return <CodeHostingPanelSkeleton />;
  if (error && !integration)
    return (
      <CodeHostingLoadError error={error} onRetry={() => void refetch()} />
    );
  if (!integration)
    return <GithubSetupPanel projectId={projectId} appInfo={appInfo} />;

  return (
    <GithubConnectedPanel
      projectId={projectId}
      integration={integration}
      appInfo={appInfo}
    />
  );
}
