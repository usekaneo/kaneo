import type { LoadedPlugin } from "../types";

export type EnablementPlugin = Pick<LoadedPlugin, "id" | "official">;

export function resolvePluginEnabled(
  plugin: Pick<LoadedPlugin, "official">,
  stored: boolean | null | undefined,
): boolean {
  return stored ?? plugin.official;
}

export function enabledPluginIds(
  plugins: readonly EnablementPlugin[],
  rows: readonly { pluginId: string; enabled: boolean }[],
): Set<string> {
  const stored = new Map(rows.map((row) => [row.pluginId, row.enabled]));
  return new Set(
    plugins
      .filter((plugin) => resolvePluginEnabled(plugin, stored.get(plugin.id)))
      .map((plugin) => plugin.id),
  );
}

export function enabledInAnyWorkspace(
  plugins: readonly EnablementPlugin[],
  rowsByWorkspace: readonly (readonly {
    pluginId: string;
    enabled: boolean;
  }[])[],
): Set<string> {
  return new Set(
    rowsByWorkspace.flatMap((rows) => [...enabledPluginIds(plugins, rows)]),
  );
}

export function enabledWorkspaceIds(
  plugin: Pick<LoadedPlugin, "official">,
  workspaces: readonly { workspaceId: string; enabled: boolean | null }[],
): string[] {
  return workspaces
    .filter((workspace) => resolvePluginEnabled(plugin, workspace.enabled))
    .map((workspace) => workspace.workspaceId);
}
