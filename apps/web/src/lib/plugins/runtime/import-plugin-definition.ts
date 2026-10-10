import {
  isWebPluginDefinition,
  type WebPluginDefinition,
} from "@kaneo/plugin-sdk/web";
import type { PluginWebAssets } from "@/types/plugin";
import { apiBaseUrl, toPluginAssetUrl } from "../plugin-urls";
import { injectPluginStylesheet } from "./inject-plugin-stylesheet";
import { normalizeWebDefinition } from "./normalize-web-definition";

export async function importPluginDefinition(plugin: {
  id: string;
  web: PluginWebAssets;
}): Promise<WebPluginDefinition> {
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
