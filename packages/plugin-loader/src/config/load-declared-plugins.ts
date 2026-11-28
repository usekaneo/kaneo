import type { PluginDescriptor } from "@kaneo/plugin-sdk";
import { loadOfficialDescriptors } from "../official/load-official-descriptors.js";
import {
  OFFICIAL_PLUGINS,
  type OfficialPlugin,
} from "../official/official-plugins.js";
import { selectOfficialPlugins } from "../official/select-official-plugins.js";
import { EMPTY_CONFIG, type LoadedConfig, loadConfig } from "./load-config.js";

export type DeclaredPlugins = {
  config: LoadedConfig;
  descriptors: PluginDescriptor[];
  official: ReadonlySet<PluginDescriptor>;
  skippedOfficial: OfficialPlugin[];
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
  { officialBaseDir }: { officialBaseDir: string | null },
): Promise<DeclaredPlugins> {
  const config = await loadDeclaredConfig(configPath);
  const selected = selectOfficialPlugins(OFFICIAL_PLUGINS, config.official);
  const official =
    officialBaseDir === null
      ? []
      : await loadOfficialDescriptors(selected, officialBaseDir);
  return {
    config,
    descriptors: [...official, ...config.plugins],
    official: new Set(official),
    skippedOfficial: officialBaseDir === null ? selected : [],
  };
}
