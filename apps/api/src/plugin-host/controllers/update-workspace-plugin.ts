import { parseSettings, type SettingsErrors } from "@kaneo/plugin-sdk";
import { HTTPException } from "hono/http-exception";
import { publishEvent } from "../../events";
import {
  getWorkspacePlugin,
  saveWorkspacePlugin,
} from "../data/workspace-plugins";
import { toWorkspacePluginWrite } from "../data/workspace-plugin-write";
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
  const stored = existing?.settings ?? {};
  let settings: Record<string, unknown> | undefined;

  if (input.settings !== undefined) {
    const parsed = parseSettings(plugin.settings, input.settings, stored);
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
    const current = settings ?? stored;
    const complete = parseSettings(plugin.settings, current, current);
    if (!complete.ok) {
      return {
        ok: false,
        message: "Fill in the required settings before enabling this plugin",
        errors: complete.errors,
      };
    }
  }

  const row = await saveWorkspacePlugin(
    pluginId,
    workspaceId,
    toWorkspacePluginWrite(plugin, { enabled: input.enabled, settings }),
  );
  await publishEvent("workspace_plugin.updated", {
    workspaceId,
    pluginId,
    enabled: row.enabled,
  });
  return { ok: true, state: toWorkspaceState(plugin, row) };
}
