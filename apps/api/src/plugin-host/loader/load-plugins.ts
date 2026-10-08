import type { PluginDescriptor } from "@kaneo/plugin-sdk";
import { startServerPlugin } from "../context/start-server-plugin";
import { getLoadedPlugin, registerLoadedPlugin } from "../registry";
import type { LoadedPlugin } from "../types";
import { idClashError } from "./id-clash";
import { preparePlugin } from "./prepare-plugin";
import { createStageRunner } from "./stage-runner";

export type LoadPluginsOptions = {
  configPath: string;
  kaneoVersion: string | null;
  official?: ReadonlySet<PluginDescriptor>;
};

async function loadPlugin(
  descriptor: PluginDescriptor,
  { configPath, kaneoVersion, official }: LoadPluginsOptions,
): Promise<LoadedPlugin> {
  const stage = createStageRunner(descriptor, { configPath, kaneoVersion });
  const { plugin, entries, options, definition } = await preparePlugin(
    descriptor,
    stage,
    { kaneoVersion },
  );

  return stage.run("start", async () => {
    const existing = getLoadedPlugin(plugin.id);
    if (existing) {
      throw idClashError(existing, plugin.packageName, configPath);
    }
    const loaded: LoadedPlugin = {
      id: plugin.id,
      name: plugin.name,
      packageName: plugin.packageName,
      version: plugin.version,
      description: plugin.description,
      official: official?.has(descriptor) ?? false,
      settings: definition?.settings ?? {},
      options,
      server: null,
      web: entries.web,
    };
    if (definition) {
      loaded.server = await startServerPlugin(loaded, definition);
    }
    registerLoadedPlugin(loaded);
    return loaded;
  });
}

export async function loadPlugins(
  descriptors: readonly PluginDescriptor[],
  options: LoadPluginsOptions,
): Promise<LoadedPlugin[]> {
  const loaded: LoadedPlugin[] = [];
  for (const descriptor of descriptors) {
    loaded.push(await loadPlugin(descriptor, options));
  }
  return loaded;
}
