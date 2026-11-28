import { resolvePluginEnabled } from "../enablement/resolve-enabled";
import type { LoadedPlugin } from "../types";

export type WorkspacePluginChanges = {
  enabled?: boolean;
  settings?: Record<string, unknown>;
};

export type WorkspacePluginWrite = {
  insert: { enabled: boolean; settings: Record<string, unknown> };
  update: WorkspacePluginChanges;
};

export function toWorkspacePluginWrite(
  plugin: Pick<LoadedPlugin, "official">,
  changes: WorkspacePluginChanges,
): WorkspacePluginWrite {
  const update: WorkspacePluginChanges = {};
  if (changes.enabled !== undefined) {
    update.enabled = changes.enabled;
  }
  if (changes.settings !== undefined) {
    update.settings = changes.settings;
  }
  return {
    insert: {
      enabled: changes.enabled ?? resolvePluginEnabled(plugin, undefined),
      settings: changes.settings ?? {},
    },
    update,
  };
}
