import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import PageTitle from "@/components/page-title";
import { PluginSettingsCard } from "@/components/plugins/settings/plugin-settings-card";
import { PluginsEmptyState } from "@/components/plugins/settings/plugins-empty-state";
import { SettingsPage } from "@/components/settings/settings-page";
import { Spinner } from "@/components/ui/spinner";
import { useGetPlugins } from "@/hooks/queries/plugin/use-get-plugins";
import { useWorkspacePermission } from "@/hooks/use-workspace-permission";
import { usePlugins } from "@/lib/plugins/runtime/plugins-context";

export const Route = createFileRoute(
  "/_layout/_authenticated/dashboard/settings/workspace/plugins",
)({
  component: RouteComponent,
});

function RouteComponent() {
  const { t } = useTranslation();
  const { workspace, canManageWorkspace } = useWorkspacePermission();
  const workspaceId = workspace?.id;
  const canEdit = canManageWorkspace();
  const { data, isPending, isError } = useGetPlugins(workspaceId);
  const { plugins: runtimePlugins } = usePlugins();
  const installed = data?.plugins ?? [];

  return (
    <>
      <PageTitle title={t("settings:workspacePlugins.pageTitle")} />
      <SettingsPage
        title={t("settings:workspacePlugins.title")}
        description={t("settings:workspacePlugins.subtitle")}
      >
        {!workspaceId || isPending ? (
          <div className="flex justify-center py-8">
            <Spinner className="size-5 text-muted-foreground" />
          </div>
        ) : isError ? (
          <p role="alert" className="text-sm text-destructive-foreground">
            {t("settings:workspacePlugins.loadError")}
          </p>
        ) : installed.length === 0 ? (
          <PluginsEmptyState />
        ) : (
          <div className="space-y-4">
            {installed.map((plugin) => (
              <PluginSettingsCard
                key={plugin.id}
                plugin={plugin}
                runtime={runtimePlugins.find(
                  (runtime) => runtime.plugin.id === plugin.id,
                )}
                workspaceId={workspaceId}
                canEdit={canEdit}
              />
            ))}
          </div>
        )}
      </SettingsPage>
    </>
  );
}
