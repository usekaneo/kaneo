import { useProjectWebSocket } from "@/hooks/use-project-websocket";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { filterEnabledIntegrations } from "@/components/project/integrations/filter-enabled-integrations";
import { INTEGRATIONS } from "@/components/project/integrations/integration-definitions";
import { IntegrationsGroup } from "@/components/project/integrations/integrations-group";
import { useIntegrationStatuses } from "@/components/project/integrations/use-integration-statuses";
import { SettingsPage } from "@/components/settings/settings-page";
import useGetConfig from "@/hooks/queries/config/use-get-config";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/integrations",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();
  useProjectWebSocket(projectId);
  const { statuses, retry } = useIntegrationStatuses(projectId);
  const { data: config } = useGetConfig();
  const integrations = filterEnabledIntegrations(
    INTEGRATIONS,
    config?.disabledIntegrations ?? [],
    statuses,
  );
  const groups = [
    {
      title: t("settings:projectIntegrations.codeHostingTitle"),
      category: "code",
    },
    { title: t("settings:projectIntegrations.chatTitle"), category: "chat" },
  ] as const;

  return (
    <>
      <PageTitle title={t("settings:projectIntegrations.pageTitle")} />
      <SettingsPage
        title={t("settings:projectIntegrations.title")}
        description={t("settings:projectIntegrations.subtitle")}
      >
        {groups.map(({ title, category }) => {
          const shown = integrations.filter(
            (integration) => integration.category === category,
          );
          return shown.length > 0 ? (
            <IntegrationsGroup
              key={category}
              title={title}
              integrations={shown}
              projectId={projectId}
              statuses={statuses}
              disabledProviders={config?.disabledIntegrations ?? []}
              onRetry={retry}
            />
          ) : null;
        })}
      </SettingsPage>
    </>
  );
}
