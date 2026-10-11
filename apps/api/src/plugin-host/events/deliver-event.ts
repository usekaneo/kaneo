import type { PluginEvent, PluginEventName } from "@kaneo/plugin-sdk";
import type { LoadedPlugin } from "../types";

export function pluginsHandling(
  plugins: readonly LoadedPlugin[],
  type: PluginEventName,
): LoadedPlugin[] {
  return plugins.filter(
    (plugin) => (plugin.server?.handlers.get(type)?.length ?? 0) > 0,
  );
}

export async function deliverEvent(
  plugins: readonly LoadedPlugin[],
  enabledPluginIds: ReadonlySet<string>,
  event: PluginEvent,
): Promise<void> {
  for (const plugin of plugins) {
    if (!enabledPluginIds.has(plugin.id)) continue;
    for (const handler of plugin.server?.handlers.get(event.type) ?? []) {
      try {
        await handler({ ...event });
      } catch (error) {
        console.error(
          `[plugin:${plugin.id}] ${event.type} handler failed`,
          error,
        );
      }
    }
  }
}
