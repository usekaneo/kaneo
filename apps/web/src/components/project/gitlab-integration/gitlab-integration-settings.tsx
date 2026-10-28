import { CodeHostingLoadError } from "@/components/project/code-hosting/code-hosting-load-error";
import { CodeHostingPanelSkeleton } from "@/components/project/code-hosting/code-hosting-panel-skeleton";
import { GitlabConnectedPanel } from "@/components/project/gitlab-integration/gitlab-connected-panel";
import { GitlabSetupPanel } from "@/components/project/gitlab-integration/gitlab-setup-panel";
import useGetGitlabIntegration from "@/hooks/queries/gitlab-integration/use-get-gitlab-integration";

type GitlabIntegrationSettingsProps = {
  projectId: string;
};

export function GitlabIntegrationSettings({
  projectId,
}: GitlabIntegrationSettingsProps) {
  const {
    data: integration,
    isLoading,
    error,
    refetch,
  } = useGetGitlabIntegration(projectId);

  if (isLoading) return <CodeHostingPanelSkeleton />;
  if (error && !integration)
    return (
      <CodeHostingLoadError error={error} onRetry={() => void refetch()} />
    );
  if (!integration) return <GitlabSetupPanel projectId={projectId} />;

  return (
    <GitlabConnectedPanel projectId={projectId} integration={integration} />
  );
}
