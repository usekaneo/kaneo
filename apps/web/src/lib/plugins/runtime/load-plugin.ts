import { pluginLoadKey, usePluginRuntimeStore } from "@/store/plugin-runtime";
import type { PluginWebAssets } from "@/types/plugin";
import { importPluginDefinition } from "./import-plugin-definition";
import { registerPluginTranslations } from "./plugin-translations";

type LoadablePlugin = {
  id: string;
  version: string;
  web: PluginWebAssets;
};

const loads = new Map<string, Promise<void>>();

export function loadPlugin(plugin: LoadablePlugin): Promise<void> {
  const key = pluginLoadKey(plugin.id, plugin.version);
  const existing = loads.get(key);
  if (existing) return existing;

  const { setState } = usePluginRuntimeStore.getState();
  setState(key, { status: "loading" });

  const load = importPluginDefinition(plugin)
    .then((definition) => {
      if (definition.translations) {
        registerPluginTranslations(plugin.id, definition.translations);
      }
      setState(key, { status: "loaded", definition });
    })
    .catch((error: unknown) => {
      console.error(`Failed to load Kaneo plugin "${plugin.id}"`, error);
      loads.delete(key);
      setState(key, {
        status: "failed",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });
  loads.set(key, load);
  return load;
}
