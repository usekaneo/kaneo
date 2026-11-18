import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeHostingLoadError } from "@/components/project/code-hosting/code-hosting-load-error";
import { CodeHostingPanelSkeleton } from "@/components/project/code-hosting/code-hosting-panel-skeleton";
import { GithubConnectedPanel } from "@/components/project/github-integration/github-connected-panel";
import { GithubSetupPanel } from "@/components/project/github-integration/github-setup-panel";
import { useGithubAppInfo } from "@/components/project/github-integration/use-github-app-info";
import { Button } from "@/components/ui/button";
import useGetGithubIntegrations from "@/hooks/queries/github-integration/use-get-github-integrations";

type GitHubIntegrationSettingsProps = {
  projectId: string;
};

export function GitHubIntegrationSettings({
  projectId,
}: GitHubIntegrationSettingsProps) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } =
    useGetGithubIntegrations(projectId);
  const { data: appInfo } = useGithubAppInfo();
  const [adding, setAdding] = useState(false);

  if (isLoading) return <CodeHostingPanelSkeleton />;
  if (error && !data)
    return (
      <CodeHostingLoadError error={error} onRetry={() => void refetch()} />
    );

  const integrations = data?.integrations ?? [];
  const connected = integrations.length > 0;

  // One panel per repository binding; the same setup flow adds more.
  return (
    <div className="space-y-4">
      {integrations.map((integration) => (
        <GithubConnectedPanel
          key={integration.id}
          projectId={projectId}
          integration={integration}
          appInfo={appInfo}
        />
      ))}
      {connected && !adding ? (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setAdding(true)}
        >
          {t("settings:codeHosting.addAnotherRepository")}
        </Button>
      ) : null}
      {!connected || adding ? (
        <GithubSetupPanel
          projectId={projectId}
          appInfo={appInfo}
          onConnected={connected ? () => setAdding(false) : undefined}
        />
      ) : null}
    </div>
  );
}
