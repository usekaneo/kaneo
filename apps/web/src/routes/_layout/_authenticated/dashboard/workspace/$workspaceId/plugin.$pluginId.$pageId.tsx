import { createFileRoute } from "@tanstack/react-router";
import WorkspaceLayout from "@/components/common/workspace-layout";
import PageTitle from "@/components/page-title";
import { PluginBoundary } from "@/components/plugins/plugin-boundary";
import { PluginPageStatus } from "@/components/plugins/plugin-page-status";
import { usePlugins } from "@/lib/plugins/runtime/plugins-context";
import { findContribution } from "@/lib/plugins/runtime/select-contributions";
import { usePluginLabel } from "@/lib/plugins/runtime/use-plugin-label";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/workspace/$workspaceId/plugin/$pluginId/$pageId",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { workspaceId, pluginId, pageId } = Route.useParams();
  const { plugins, isPending } = usePlugins();
  const label = usePluginLabel();
  const lookup = findContribution(
    plugins,
    "pages",
    pluginId,
    pageId,
    isPending,
  );
  const title =
    lookup.status === "ready"
      ? label(pluginId, lookup.contribution.item.title)
      : (plugins.find((runtime) => runtime.plugin.id === pluginId)?.plugin
          .name ?? "");

  return (
    <>
      {title ? <PageTitle title={title} /> : null}
      <WorkspaceLayout title={title}>
        {lookup.status === "ready" ? (
          <PluginBoundary scope={lookup.contribution.scope}>
            <lookup.contribution.item.component workspaceId={workspaceId} />
          </PluginBoundary>
        ) : (
          <PluginPageStatus
            status={lookup.status}
            error={lookup.status === "failed" ? lookup.error : undefined}
          />
        )}
      </WorkspaceLayout>
    </>
  );
}
