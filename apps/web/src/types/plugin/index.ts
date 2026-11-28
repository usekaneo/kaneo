import type { SettingsSchema } from "@kaneo/plugin-sdk";

export type PluginWebAssets = {
  entry: string;
  styles: string | null;
};

export type PluginWorkspaceState = {
  enabled: boolean;
  settings: Record<string, unknown>;
  configuredSecrets: string[];
};

export type InstalledPlugin = {
  id: string;
  name: string;
  packageName: string;
  version: string;
  description: string | null;
  official: boolean;
  settings: SettingsSchema;
  web: PluginWebAssets | null;
  workspace: PluginWorkspaceState | null;
};

export type InstalledPluginsResponse = {
  plugins: InstalledPlugin[];
};

export type UpdatePluginWorkspaceRequest = {
  enabled?: boolean;
  settings?: Record<string, unknown>;
};
