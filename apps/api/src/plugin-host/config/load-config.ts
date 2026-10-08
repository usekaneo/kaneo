import { pathToFileURL } from "node:url";
import { isPluginDescriptor, type PluginDescriptor } from "@kaneo/plugin-sdk";
import { errorMessage, PluginLoadError } from "../load-error";
import type { OfficialToggles } from "../official/select-official-plugins";

export type LoadedConfig = {
  official: OfficialToggles;
  plugins: PluginDescriptor[];
};

export const EMPTY_CONFIG: LoadedConfig = { official: {}, plugins: [] };

function configError(path: string, message: string, cause?: unknown) {
  return new PluginLoadError({
    plugin: null,
    stage: "config",
    message,
    hint: `Fix ${path}, or set DISABLE_PLUGINS=true to start without plugins.`,
    cause,
  });
}

function describeEntry(entry: unknown, index: number): string {
  if (typeof entry === "function") {
    return `plugins[${index}] is a function. Call the plugin's factory, like progress(), instead of passing it.`;
  }
  return `plugins[${index}] is not a Kaneo plugin.`;
}

function readPlugins(path: string, plugins: unknown): PluginDescriptor[] {
  if (plugins === undefined) return [];
  if (!Array.isArray(plugins)) {
    throw configError(path, '"plugins" must be an array.');
  }
  plugins.forEach((entry, index) => {
    if (!isPluginDescriptor(entry)) {
      throw configError(path, describeEntry(entry, index));
    }
  });
  return plugins as PluginDescriptor[];
}

function readOfficial(
  path: string,
  official: unknown,
  officialIds: readonly string[],
): OfficialToggles {
  if (official === undefined) return {};
  if (
    typeof official !== "object" ||
    official === null ||
    Array.isArray(official)
  ) {
    throw configError(
      path,
      '"official" must be an object, like { gantt: false }.',
    );
  }
  for (const [id, value] of Object.entries(official)) {
    if (!officialIds.includes(id)) {
      throw configError(
        path,
        `official.${id} is not a built-in plugin. Use one of: ${officialIds.join(", ")}.`,
      );
    }
    if (typeof value !== "boolean") {
      throw configError(path, `official.${id} must be true or false.`);
    }
  }
  return official as OfficialToggles;
}

export async function loadConfig(
  path: string,
  officialIds: readonly string[],
): Promise<LoadedConfig> {
  let module: { default?: unknown };
  try {
    module = await import(pathToFileURL(path).href);
  } catch (error) {
    throw configError(path, errorMessage(error), error);
  }

  const config = module.default;
  if (typeof config !== "object" || config === null || Array.isArray(config)) {
    throw configError(
      path,
      "The config must have a default export created with defineConfig().",
    );
  }

  const { official, plugins } = config as {
    official?: unknown;
    plugins?: unknown;
  };
  return {
    official: readOfficial(path, official, officialIds),
    plugins: readPlugins(path, plugins),
  };
}
