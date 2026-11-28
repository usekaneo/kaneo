import type { Plugin } from "../api/plugins.js";

export type PluginJson = {
  readonly id: string;
  readonly name: string;
  readonly packageName: string;
  readonly version: string;
  readonly description: string | null;
  readonly official: boolean;
  readonly enabled: boolean;
};

export function toPluginJson(plugin: Plugin): PluginJson {
  return {
    id: plugin.id,
    name: plugin.name,
    packageName: plugin.packageName,
    version: plugin.version,
    description: plugin.description,
    official: plugin.official,
    enabled: plugin.workspace?.enabled ?? false,
  };
}
