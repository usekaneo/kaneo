import { Effect, Option } from "effect";
import { CliEnvironment } from "../services/cli-environment.js";
import { configPackageVersion } from "./config-package-version.js";
import { findInstallation, type Installation } from "./kaneo-installation.js";
import { type KaneoTarget, resolveKaneoTarget } from "./kaneo-target.js";

export type PluginTarget = KaneoTarget & {
  readonly installation: Installation | null;
};

export const resolvePluginTarget = Effect.fnUntraced(function* (options: {
  readonly kaneoVersion: Option.Option<string>;
  readonly projectDir: string;
  readonly cliDir: string | null;
}) {
  const environment = yield* CliEnvironment;
  const installation = findInstallation([options.cliDir, environment.cwd]);
  const target = yield* Effect.fromResult(
    resolveKaneoTarget({
      flag: Option.getOrUndefined(options.kaneoVersion),
      installationVersion: installation?.version ?? null,
      configPackageVersion: configPackageVersion(options.projectDir),
    }),
  );
  return { ...target, installation } satisfies PluginTarget;
});
