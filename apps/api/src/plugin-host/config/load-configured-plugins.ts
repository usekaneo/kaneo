import { getKaneoVersion } from "../kaneo-version";
import { loadPlugins } from "../loader/load-plugins";
import type { LoadedPlugin } from "../types";
import { DEFAULT_CONFIG_PATH, findConfigPath } from "./find-config-path";
import { loadDeclaredPlugins } from "./load-declared-plugins";

export async function loadConfiguredPlugins(): Promise<LoadedPlugin[]> {
  if (process.env.DISABLE_PLUGINS === "true") {
    console.log("🧩 Plugins are disabled (DISABLE_PLUGINS=true)");
    return [];
  }

  const configPath = findConfigPath();
  const { config, descriptors, official } =
    await loadDeclaredPlugins(configPath);
  const loaded = await loadPlugins(descriptors, {
    configPath: configPath ?? DEFAULT_CONFIG_PATH,
    kaneoVersion: getKaneoVersion(),
    official,
  });

  for (const plugin of loaded) {
    console.log(
      `🧩 Loaded ${plugin.official ? "built-in plugin" : "plugin"} ${plugin.packageName} ${plugin.version} as "${plugin.id}"`,
    );
  }
  if (configPath && config.plugins.length === 0) {
    console.log(`🧩 ${configPath} declares no plugins`);
  }
  return loaded;
}
