import type { PluginDescriptor } from "@kaneo/plugin-sdk";
import { loadOfficialDescriptors } from "../official/load-official-descriptors";
import { OFFICIAL_PLUGINS } from "../official/official-plugins";
import { selectOfficialPlugins } from "../official/select-official-plugins";
import { EMPTY_CONFIG, type LoadedConfig, loadConfig } from "./load-config";

export type DeclaredPlugins = {
  config: LoadedConfig;
  descriptors: PluginDescriptor[];
  official: ReadonlySet<PluginDescriptor>;
};

export async function loadDeclaredConfig(
  configPath: string | null,
): Promise<LoadedConfig> {
  return configPath
    ? loadConfig(
        configPath,
        OFFICIAL_PLUGINS.map((plugin) => plugin.id),
      )
    : EMPTY_CONFIG;
}

export async function loadDeclaredPlugins(
  configPath: string | null,
): Promise<DeclaredPlugins> {
  const config = await loadDeclaredConfig(configPath);
  const official = await loadOfficialDescriptors(
    selectOfficialPlugins(OFFICIAL_PLUGINS, config.official),
  );
  return {
    config,
    descriptors: [...official, ...config.plugins],
    official: new Set(official),
  };
}
