import type { OfficialToggles } from "../../../plugin-host/official/select-official-plugins";

export function purgeRefusal({
  pluginId,
  officialIds,
  officialToggles,
  configuredIds,
  configName,
}: {
  pluginId: string;
  officialIds: readonly string[];
  officialToggles: OfficialToggles;
  configuredIds: readonly string[];
  configName: string;
}): string | null {
  if (configuredIds.includes(pluginId)) {
    return `Plugin "${pluginId}" is still installed. Remove it from ${configName} and restart Kaneo, then purge its data.`;
  }
  if (officialIds.includes(pluginId) && officialToggles[pluginId] !== false) {
    return `"${pluginId}" is a built-in plugin and it is still on. Turn it off with official: { ${pluginId}: false } in ${configName} and restart Kaneo, then purge its data.`;
  }
  return null;
}
