import type { IconComponent } from "@kaneo/plugin-sdk/web";
import { usePlugins } from "./plugins-context";
import { selectContributions } from "./select-contributions";
import { usePluginLabel } from "./use-plugin-label";

export type PluginViewRef = {
  pluginId: string;
  viewId: string;
};

export type ProjectPluginView = PluginViewRef & {
  title: string;
  icon: IconComponent | undefined;
  shortcut: string | undefined;
};

export function isSamePluginView(
  active: PluginViewRef | undefined,
  view: PluginViewRef,
): boolean {
  return active?.pluginId === view.pluginId && active.viewId === view.viewId;
}

export function useProjectPluginViews(): ProjectPluginView[] {
  const { plugins } = usePlugins();
  const label = usePluginLabel();

  return selectContributions(plugins, "projectViews").map(
    ({ scope, item }) => ({
      pluginId: scope.id,
      viewId: item.id,
      title: label(scope.id, item.title),
      icon: item.icon,
      shortcut: item.shortcut,
    }),
  );
}
