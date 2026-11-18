import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeHostingLoadError } from "@/components/project/code-hosting/code-hosting-load-error";
import { CodeHostingPanelSkeleton } from "@/components/project/code-hosting/code-hosting-panel-skeleton";
import { GitlabConnectedPanel } from "@/components/project/gitlab-integration/gitlab-connected-panel";
import { GitlabSetupPanel } from "@/components/project/gitlab-integration/gitlab-setup-panel";
import { Button } from "@/components/ui/button";
import useGetGitlabIntegrations from "@/hooks/queries/gitlab-integration/use-get-gitlab-integrations";

type GitlabIntegrationSettingsProps = {
  projectId: string;
};

export function GitlabIntegrationSettings({
  projectId,
}: GitlabIntegrationSettingsProps) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } =
    useGetGitlabIntegrations(projectId);
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
        <GitlabConnectedPanel
          key={integration.id}
          projectId={projectId}
          integration={integration}
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
        <GitlabSetupPanel
          projectId={projectId}
          onConnected={connected ? () => setAdding(false) : undefined}
        />
      ) : null}
    </div>
  );
}
