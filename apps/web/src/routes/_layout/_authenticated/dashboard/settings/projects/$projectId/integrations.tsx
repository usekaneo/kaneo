import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { GitHubIntegrationSettings } from "@/components/project/github-integration-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/integrations",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { projectId } = Route.useParams();

  return (
    <>
      <PageTitle title={t("settings:projectIntegrations.pageTitle")} />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {t("settings:projectIntegrations.title")}
          </h1>
          <p className="text-muted-foreground">
            {t("settings:projectIntegrations.subtitle")}
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">
              {t("settings:projectIntegrations.githubSectionTitle")}
            </h2>
            <p className="text-xs text-muted-foreground">
              {t("settings:projectIntegrations.githubSectionSubtitle")}
            </p>
          </div>

          <div className="space-y-4">
            <GitHubIntegrationSettings projectId={projectId} />
          </div>
        </div>
      </div>
    </>
  );
}
