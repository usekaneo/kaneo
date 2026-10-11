import type { PluginViewRef } from "./use-project-plugin-views";

export type PluginViewShortcut = PluginViewRef & { key: string };

const SHORTCUT_KEY = /^[a-z0-9]$/;

export function selectViewShortcuts(
  views: readonly (PluginViewRef & { shortcut?: unknown })[],
  reservedKeys: readonly string[],
): PluginViewShortcut[] {
  const taken = new Set(reservedKeys.map((key) => key.toLowerCase()));
  const selected: PluginViewShortcut[] = [];
  for (const view of views) {
    if (typeof view.shortcut !== "string") continue;
    const key = view.shortcut.trim().toLowerCase();
    if (!SHORTCUT_KEY.test(key) || taken.has(key)) continue;
    taken.add(key);
    selected.push({ pluginId: view.pluginId, viewId: view.viewId, key });
  }
  return selected;
}
