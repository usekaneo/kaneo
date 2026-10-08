import { isWebPluginDefinition } from "@kaneo/plugin-sdk/web";
import { pluginLoadKey, usePluginRuntimeStore } from "@/store/plugin-runtime";
import type { PluginWebAssets } from "@/types/plugin";
import { apiBaseUrl, toPluginAssetUrl } from "../plugin-urls";
import { injectPluginStylesheet } from "./inject-plugin-stylesheet";
import { normalizeWebDefinition } from "./normalize-web-definition";
import { registerPluginTranslations } from "./plugin-translations";

type LoadablePlugin = {
  id: string;
  version: string;
  web: PluginWebAssets;
};

const loads = new Map<string, Promise<void>>();

async function importDefinition(plugin: LoadablePlugin) {
  const baseUrl = apiBaseUrl();
  const [module] = await Promise.all([
    import(/* @vite-ignore */ toPluginAssetUrl(baseUrl, plugin.web.entry)),
    plugin.web.styles
      ? injectPluginStylesheet(
          plugin.id,
          toPluginAssetUrl(baseUrl, plugin.web.styles),
        )
      : undefined,
  ]);
  const definition = (module as { default?: unknown }).default;
  if (!isWebPluginDefinition(definition)) {
    throw new Error(
      `Plugin "${plugin.id}" web entry does not export a defineWeb() definition`,
    );
  }
  return normalizeWebDefinition(definition);
}

export function loadPlugin(plugin: LoadablePlugin): Promise<void> {
  const key = pluginLoadKey(plugin.id, plugin.version);
  const existing = loads.get(key);
  if (existing) return existing;

  const { setState } = usePluginRuntimeStore.getState();
  setState(key, { status: "loading" });

  const load = importDefinition(plugin)
    .then((definition) => {
      if (definition.translations) {
        registerPluginTranslations(plugin.id, definition.translations);
      }
      setState(key, { status: "loaded", definition });
    })
    .catch((error: unknown) => {
      console.error(`Failed to load Kaneo plugin "${plugin.id}"`, error);
      setState(key, {
        status: "failed",
        error: error instanceof Error ? error : new Error(String(error)),
      });
    });
  loads.set(key, load);
  return load;
}
