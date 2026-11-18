import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CodeHostingLoadError } from "@/components/project/code-hosting/code-hosting-load-error";
import { CodeHostingPanelSkeleton } from "@/components/project/code-hosting/code-hosting-panel-skeleton";
import { GiteaConnectedPanel } from "@/components/project/gitea-integration/gitea-connected-panel";
import { GiteaSetupPanel } from "@/components/project/gitea-integration/gitea-setup-panel";
import { Button } from "@/components/ui/button";
import useGetGiteaIntegrations from "@/hooks/queries/gitea-integration/use-get-gitea-integrations";

type GiteaIntegrationSettingsProps = {
  projectId: string;
};

export function GiteaIntegrationSettings({
  projectId,
}: GiteaIntegrationSettingsProps) {
  const { t } = useTranslation();
  const { data, isLoading, error, refetch } =
    useGetGiteaIntegrations(projectId);
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
        <GiteaConnectedPanel
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
        <GiteaSetupPanel
          projectId={projectId}
          onConnected={connected ? () => setAdding(false) : undefined}
        />
      ) : null}
    </div>
  );
}
