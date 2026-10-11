import { toPublicSettings } from "@kaneo/plugin-sdk";
import type { WorkspacePluginRow } from "../data/workspace-plugins";
import { resolvePluginEnabled } from "../enablement/resolve-enabled";
import type { LoadedPlugin } from "../types";

export type WorkspacePluginState = {
  enabled: boolean;
  settings: Record<string, unknown>;
  configuredSecrets: string[];
};

export function toWorkspaceState(
  plugin: Pick<LoadedPlugin, "official" | "settings">,
  row: Pick<WorkspacePluginRow, "enabled" | "settings"> | undefined,
): WorkspacePluginState {
  const { values, configuredSecrets } = toPublicSettings(
    plugin.settings,
    row?.settings ?? {},
  );
  return {
    enabled: resolvePluginEnabled(plugin, row?.enabled),
    settings: values,
    configuredSecrets,
  };
}

function assetUrl(plugin: LoadedPlugin, file: string): string {
  return `/plugins/${plugin.id}/assets/${encodeURIComponent(file)}?v=${encodeURIComponent(plugin.version)}`;
}

export function toPluginSummary(
  plugin: LoadedPlugin,
  workspace: WorkspacePluginState | null,
) {
  return {
    id: plugin.id,
    name: plugin.name,
    packageName: plugin.packageName,
    version: plugin.version,
    description: plugin.description,
    official: plugin.official,
    settings: plugin.settings,
    web: plugin.web
      ? {
          entry: assetUrl(plugin, plugin.web.entry),
          styles: plugin.web.styles
            ? assetUrl(plugin, plugin.web.styles)
            : null,
        }
      : null,
    workspace,
  };
}
