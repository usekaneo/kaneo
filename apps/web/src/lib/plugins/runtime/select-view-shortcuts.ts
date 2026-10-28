import type { PluginViewRef } from "../plugin-layout-id";

type ShortcutCandidate = PluginViewRef & { title: string; shortcut?: unknown };

export type PluginViewShortcut = PluginViewRef & { title: string; key: string };

const SHORTCUT_KEY = /^[a-z0-9]$/;

export function selectViewShortcuts(
  views: readonly ShortcutCandidate[],
  reservedKeys: readonly string[],
): PluginViewShortcut[] {
  const taken = new Set(reservedKeys.map((key) => key.toLowerCase()));
  const selected: PluginViewShortcut[] = [];
  for (const view of views) {
    if (typeof view.shortcut !== "string") continue;
    const key = view.shortcut.trim().toLowerCase();
    if (!SHORTCUT_KEY.test(key) || taken.has(key)) continue;
    taken.add(key);
    selected.push({
      pluginId: view.pluginId,
      viewId: view.viewId,
      title: view.title,
      key,
    });
  }
  return selected;
}
