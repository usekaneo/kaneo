import { createFileRoute } from "@tanstack/react-router";
import PageTitle from "@/components/page-title";
import { GitHubIntegrationSettings } from "@/components/project/github-integration-settings";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/projects/$projectId/integrations",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  return (
    <>
      <PageTitle title="Project Integrations" />
      <div className="max-w-4xl mx-auto space-y-8">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">Project Integrations</h1>
          <p className="text-muted-foreground">
            Connect your project with external tools and services to streamline
            your workflow.
          </p>
        </div>

        <div className="space-y-6">
          <div className="space-y-1">
            <h2 className="text-md font-medium">GitHub Integration</h2>
            <p className="text-xs text-muted-foreground">
              Synchronize tasks with GitHub issues and enable two-way sync.
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
