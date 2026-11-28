import type { PluginDescriptor } from "@kaneo/plugin-sdk";
import { PluginLoadError } from "../load-error.js";
import { idClashError, type PluginIdentity } from "./id-clash.js";
import { preparePlugin } from "./prepare-plugin.js";
import { createStageRunner } from "./stage-runner.js";

export type CheckPluginsOptions = {
  configPath: string;
  kaneoVersion: string | null;
  official?: ReadonlySet<PluginDescriptor>;
  onWarning?: (message: string) => void;
};

export type PluginCheck =
  | {
      ok: true;
      id: string;
      packageName: string;
      version: string;
      official: boolean;
    }
  | { ok: false; official: boolean; error: PluginLoadError };

export async function checkPlugins(
  descriptors: readonly PluginDescriptor[],
  { configPath, kaneoVersion, official, onWarning }: CheckPluginsOptions,
): Promise<PluginCheck[]> {
  const seen = new Map<string, PluginIdentity>();
  const results: PluginCheck[] = [];
  for (const descriptor of descriptors) {
    const isOfficial = official?.has(descriptor) ?? false;
    const stage = createStageRunner(descriptor, {
      configPath,
      kaneoVersion,
      official: isOfficial,
    });
    try {
      const { plugin } = await preparePlugin(descriptor, stage, {
        kaneoVersion,
        onWarning,
      });
      await stage.run("start", () => {
        const existing = seen.get(plugin.id);
        if (existing) {
          throw idClashError(existing, plugin.packageName, configPath);
        }
      });
      seen.set(plugin.id, {
        id: plugin.id,
        packageName: plugin.packageName,
        official: isOfficial,
      });
      results.push({
        ok: true,
        id: plugin.id,
        packageName: plugin.packageName,
        version: plugin.version,
        official: isOfficial,
      });
    } catch (error) {
      if (!(error instanceof PluginLoadError)) throw error;
      results.push({ ok: false, official: isOfficial, error });
    }
  }
  return results;
}
