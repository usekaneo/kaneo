import { listWorkspacePlugins } from "../data/workspace-plugins";
import { listLoadedPlugins } from "../registry";
import { toPluginSummary, toWorkspaceState } from "./to-plugin-summary";

export async function listPlugins(workspaceId: string | undefined) {
  const plugins = listLoadedPlugins();
  if (!workspaceId) {
    return { plugins: plugins.map((plugin) => toPluginSummary(plugin, null)) };
  }

  const rows = new Map(
    (await listWorkspacePlugins(workspaceId)).map((row) => [row.pluginId, row]),
  );
  return {
    plugins: plugins.map((plugin) =>
      toPluginSummary(plugin, toWorkspaceState(plugin, rows.get(plugin.id))),
    ),
  };
}
