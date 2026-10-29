import { join } from "node:path";
import {
  CONFIG_FILE_NAMES,
  checkPlugins,
  errorMessage,
  loadDeclaredPlugins,
  PluginLoadError,
} from "@kaneo/plugin-loader";
import { Effect } from "effect";
import { InvalidArgument } from "../errors/errors.js";
import { type PluginCheckReport, toCheckEntry } from "./check-report.js";
import { loadFailure } from "./load-failure.js";
import type { PluginTarget } from "./plugin-target.js";

async function check(options: {
  readonly projectDir: string;
  readonly configPath: string | null;
  readonly target: PluginTarget;
}): Promise<PluginCheckReport> {
  const { projectDir, configPath, target } = options;
  const warnings: string[] = [];
  const declared = await loadDeclaredPlugins(configPath, {
    officialBaseDir: target.installation?.officialBaseDir ?? null,
  });
  const results = await checkPlugins(declared.descriptors, {
    configPath: configPath ?? join(projectDir, CONFIG_FILE_NAMES[0]),
    kaneoVersion: target.version,
    official: declared.official,
    onWarning: (message) => warnings.push(message),
  });
  const plugins = results.map(toCheckEntry);
  return {
    projectDir,
    configPath,
    declared: declared.config.plugins.length,
    kaneoVersion: target.version,
    kaneoVersionSource: target.source,
    skippedBuiltIn: declared.skippedOfficial.map((plugin) => plugin.id),
    warnings,
    plugins,
    failed: plugins.filter((entry) => entry.status === "failed").length,
  };
}

export const checkProject = (options: Parameters<typeof check>[0]) =>
  Effect.tryPromise({
    try: () => check(options),
    catch: (error) =>
      error instanceof PluginLoadError
        ? loadFailure(error)
        : new InvalidArgument({ message: errorMessage(error) }),
  });
