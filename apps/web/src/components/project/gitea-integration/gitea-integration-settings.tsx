import { CodeHostingLoadError } from "@/components/project/code-hosting/code-hosting-load-error";
import { CodeHostingPanelSkeleton } from "@/components/project/code-hosting/code-hosting-panel-skeleton";
import { GiteaConnectedPanel } from "@/components/project/gitea-integration/gitea-connected-panel";
import { GiteaSetupPanel } from "@/components/project/gitea-integration/gitea-setup-panel";
import useGetGiteaIntegration from "@/hooks/queries/gitea-integration/use-get-gitea-integration";

type GiteaIntegrationSettingsProps = {
  projectId: string;
};

export function GiteaIntegrationSettings({
  projectId,
}: GiteaIntegrationSettingsProps) {
  const {
    data: integration,
    isLoading,
    error,
    refetch,
  } = useGetGiteaIntegration(projectId);

  if (isLoading) return <CodeHostingPanelSkeleton />;
  if (error && !integration)
    return (
      <CodeHostingLoadError error={error} onRetry={() => void refetch()} />
    );
  if (!integration) return <GiteaSetupPanel projectId={projectId} />;

  return (
    <GiteaConnectedPanel projectId={projectId} integration={integration} />
  );
}
