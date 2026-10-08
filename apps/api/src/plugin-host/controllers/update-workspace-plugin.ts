import { parseSettings, type SettingsErrors } from "@kaneo/plugin-sdk";
import { HTTPException } from "hono/http-exception";
import {
  getWorkspacePlugin,
  saveWorkspacePlugin,
} from "../data/workspace-plugins";
import { resolvePluginEnabled } from "../enablement/resolve-enabled";
import { getLoadedPlugin } from "../registry";
import {
  toWorkspaceState,
  type WorkspacePluginState,
} from "./to-plugin-summary";

export type UpdateWorkspacePluginResult =
  | { ok: true; state: WorkspacePluginState }
  | { ok: false; message: string; errors: SettingsErrors };

export async function updateWorkspacePlugin(
  pluginId: string,
  workspaceId: string,
  input: { enabled?: boolean; settings?: Record<string, unknown> },
): Promise<UpdateWorkspacePluginResult> {
  const plugin = getLoadedPlugin(pluginId);
  if (!plugin) {
    throw new HTTPException(404, { message: "Plugin not found" });
  }

  const existing = await getWorkspacePlugin(pluginId, workspaceId);
  let settings = existing?.settings ?? {};

  if (input.settings !== undefined) {
    const parsed = parseSettings(plugin.settings, input.settings, settings);
    if (!parsed.ok) {
      return {
        ok: false,
        message: "Some settings are invalid",
        errors: parsed.errors,
      };
    }
    settings = parsed.values;
  }

  if (input.enabled === true) {
    const complete = parseSettings(plugin.settings, settings, settings);
    if (!complete.ok) {
      return {
        ok: false,
        message: "Fill in the required settings before enabling this plugin",
        errors: complete.errors,
      };
    }
  }

  const row = await saveWorkspacePlugin({
    pluginId,
    workspaceId,
    enabled: input.enabled ?? resolvePluginEnabled(plugin, existing?.enabled),
    settings,
  });
  return { ok: true, state: toWorkspaceState(plugin, row) };
}
