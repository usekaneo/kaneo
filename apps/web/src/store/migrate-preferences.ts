import type { PluginLayoutId } from "@/lib/plugins/plugin-layout-id";

export const PREFERENCES_VERSION = 1;

const GANTT_LAYOUT: PluginLayoutId = "plugin:gantt:timeline";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migratePreferences(persisted: unknown, version: number) {
  if (version >= PREFERENCES_VERSION || !isRecord(persisted)) return persisted;
  return persisted.taskLayout === "gantt"
    ? { ...persisted, taskLayout: GANTT_LAYOUT }
    : persisted;
}
