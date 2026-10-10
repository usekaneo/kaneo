import type { PluginDescriptor, PluginPackage } from "@kaneo/plugin-sdk";
import type { ServerPluginDefinition } from "@kaneo/plugin-sdk/server";
import { checkCompatibility } from "./check-compatibility.js";
import { importServer } from "./import-server.js";
import { type ResolvedEntries, resolveEntries } from "./resolve-entries.js";
import { resolvePackage } from "./resolve-package.js";
import { StageError } from "./stage-error.js";
import type { StageRunner } from "./stage-runner.js";
import { validateOptions } from "./validate-options.js";

export type PreparedPlugin = {
  plugin: PluginPackage;
  entries: ResolvedEntries;
  options: unknown;
  definition: ServerPluginDefinition | null;
};

export type PreparePluginOptions = {
  kaneoVersion: string | null;
  onWarning?: (message: string) => void;
};

function warnInLog(message: string): void {
  console.warn(`[plugins] ${message}`);
}

export async function preparePlugin(
  descriptor: PluginDescriptor,
  stage: StageRunner,
  { kaneoVersion, onWarning = warnInLog }: PreparePluginOptions,
): Promise<PreparedPlugin> {
  const { root, plugin } = await stage.run("resolve", () =>
    resolvePackage(descriptor.url),
  );
  stage.rename(plugin.packageName);

  const entries = await stage.run("entry", () => resolveEntries(root, plugin));

  await stage.run("compatibility", () => {
    const result = checkCompatibility(plugin, kaneoVersion);
    if (result.status === "fail") throw new StageError(result.message);
    if (result.status === "warn") onWarning(result.message);
  });

  const options = await stage.run("options", () => validateOptions(descriptor));

  const server = entries.server;
  const definition = server
    ? await stage.run("import", () => importServer(server))
    : null;

  return { plugin, entries, options, definition };
}
