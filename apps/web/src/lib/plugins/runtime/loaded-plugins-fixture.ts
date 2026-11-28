import type { WebPluginDefinition } from "@kaneo/plugin-sdk/web";
import { type PluginLoadState, pluginLoadKey } from "@/store/plugin-runtime";
import type { InstalledPlugin } from "@/types/plugin";
import { normalizeWebDefinition } from "./normalize-web-definition";
import { type RuntimePlugin, toRuntimePlugins } from "./select-contributions";

type FixturePlugin = {
  id: string;
  enabled?: boolean;
  definition: WebPluginDefinition;
};

const VERSION = "1.0.0";

export function loadedPluginsFixture(
  workspaceId: string,
  plugins: readonly FixturePlugin[],
): RuntimePlugin[] {
  const installed: InstalledPlugin[] = plugins.map(
    ({ id, enabled = true }) => ({
      id,
      name: id,
      packageName: id,
      version: VERSION,
      description: null,
      official: false,
      settings: {},
      web: { entry: `/plugins/${id}/assets/index.js`, styles: null },
      workspace: { enabled, settings: {}, configuredSecrets: [] },
    }),
  );
  const states: Record<string, PluginLoadState> = Object.fromEntries(
    plugins.map(({ id, definition }) => [
      pluginLoadKey(id, VERSION),
      { status: "loaded", definition: normalizeWebDefinition(definition) },
    ]),
  );
  return toRuntimePlugins(installed, workspaceId, states);
}
