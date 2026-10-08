import type { PluginDescriptor } from "@kaneo/plugin-sdk";

export const OFFICIAL_PLUGINS = ["gantt"] as const;

export type OfficialPluginId = (typeof OFFICIAL_PLUGINS)[number];

export type KaneoConfig = {
  official?: Partial<Record<OfficialPluginId, boolean>>;
  plugins?: PluginDescriptor[];
};

export function defineConfig(config: KaneoConfig): KaneoConfig {
  return config;
}
