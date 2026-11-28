import type { LoadedPlugin } from "./types";

const plugins = new Map<string, LoadedPlugin>();

export function registerLoadedPlugin(plugin: LoadedPlugin): void {
  if (plugins.has(plugin.id)) {
    throw new Error(`Plugin id "${plugin.id}" is already registered`);
  }
  plugins.set(plugin.id, plugin);
}

export function getLoadedPlugin(id: string): LoadedPlugin | undefined {
  return plugins.get(id);
}

export function hasLoadedPlugin(id: string): boolean {
  return plugins.has(id);
}

export function listLoadedPlugins(): LoadedPlugin[] {
  return [...plugins.values()];
}

export function clearLoadedPlugins(): void {
  plugins.clear();
}
