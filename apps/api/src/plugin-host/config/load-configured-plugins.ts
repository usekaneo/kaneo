import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  DEFAULT_CONFIG_PATH,
  findConfigPath,
  getKaneoVersion,
  loadDeclaredPlugins,
} from "@kaneo/plugin-loader";
import { loadPlugins } from "../loader/load-plugins";
import type { LoadedPlugin } from "../types";

const API_DIR = dirname(fileURLToPath(import.meta.url));

export async function loadConfiguredPlugins({
  officialBaseDir = API_DIR,
}: { officialBaseDir?: string } = {}): Promise<LoadedPlugin[]> {
  if (process.env.DISABLE_PLUGINS === "true") {
    console.log("🧩 Plugins are disabled (DISABLE_PLUGINS=true)");
    return [];
  }

  const configPath = findConfigPath();
  const { config, descriptors, official } = await loadDeclaredPlugins(
    configPath,
    { officialBaseDir },
  );
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
