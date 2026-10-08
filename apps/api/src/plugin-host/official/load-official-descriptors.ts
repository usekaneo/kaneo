import { isPluginDescriptor, type PluginDescriptor } from "@kaneo/plugin-sdk";
import { errorMessage, PluginLoadError } from "../load-error";
import type { OfficialPlugin } from "./official-plugins";

async function loadDescriptor(
  plugin: OfficialPlugin,
): Promise<PluginDescriptor> {
  const factory = (await plugin.importFactory()).default;
  if (typeof factory !== "function") {
    throw new Error(
      `${plugin.packageName} does not export a plugin factory as its default export.`,
    );
  }
  const descriptor: unknown = factory();
  if (!isPluginDescriptor(descriptor)) {
    throw new Error(
      `${plugin.packageName}'s default export did not return a Kaneo plugin.`,
    );
  }
  return descriptor;
}

export async function loadOfficialDescriptors(
  plugins: readonly OfficialPlugin[],
): Promise<PluginDescriptor[]> {
  const descriptors: PluginDescriptor[] = [];
  for (const plugin of plugins) {
    try {
      descriptors.push(await loadDescriptor(plugin));
    } catch (error) {
      throw new PluginLoadError({
        plugin: plugin.packageName,
        stage: "resolve",
        message: errorMessage(error),
        hint: `${plugin.packageName} ships with Kaneo, so reinstall Kaneo. To start without it, set official: { ${plugin.id}: false } in kaneo.config.ts.`,
        cause: error,
      });
    }
  }
  return descriptors;
}
