import type { IconComponent } from "@kaneo/plugin-sdk/web";
import useGetProject from "@/hooks/queries/project/use-get-project";
import type { PluginViewRef } from "../plugin-layout-id";
import { pluginsForWorkspace } from "./plugins-for-workspace";
import { usePlugins } from "./plugins-context";
import { selectContributions } from "./select-contributions";
import { usePluginLabel } from "./use-plugin-label";

export type ProjectPluginView = PluginViewRef & {
  title: string;
  icon: IconComponent | undefined;
  shortcut: string | undefined;
};

export function useProjectPluginViews(
  workspaceId: string,
  projectId: string,
): ProjectPluginView[] {
  const { plugins } = usePlugins();
  const { data: project } = useGetProject({ id: projectId, workspaceId });
  const label = usePluginLabel();

  return selectContributions(
    pluginsForWorkspace(plugins, workspaceId, project?.workspaceId),
    "projectViews",
  ).map(({ scope, item }) => ({
    pluginId: scope.id,
    viewId: item.id,
    title: label(scope.id, item.title),
    icon: item.icon,
    shortcut: item.shortcut,
  }));
}
