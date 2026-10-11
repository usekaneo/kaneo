import { errorMessage } from "@kaneo/plugin-loader";
import { Effect, Layer, Option } from "effect";
import { Argument, Command, Flag } from "effect/cli";
import { InvalidArgument } from "../../errors/errors.js";
import { emit } from "../../output/emit.js";
import { CLI_DIR } from "../../plugins/cli-dir.js";
import { confirmCatalog } from "../../plugins/confirm-catalog.js";
import { humanNote } from "../../plugins/human-note.js";
import { installPlugin } from "../../plugins/install-plugin.js";
import { parsePackageName } from "../../plugins/package-name.js";
import { pickRelease } from "../../plugins/pick-release.js";
import type { PluginAddResult } from "../../plugins/plugin-add-result.js";
import { resolvePluginProject } from "../../plugins/plugin-project.js";
import { resolvePluginTarget } from "../../plugins/plugin-target.js";
import { renderPluginAdd } from "../../plugins/render-plugin-add.js";
import { updateConfigFile } from "../../plugins/update-config-file.js";
import { NpmLive } from "../../services/npm.js";
import { PluginCatalogLive } from "../../services/plugin-catalog.js";
import { kaneoVersionFlag, projectDirFlag } from "./flags.js";

export const runPluginAdd = Effect.fn("command.plugin.add")(
  function* (options: {
    readonly packageName: string;
    readonly yes: boolean;
    readonly project: Option.Option<string>;
    readonly kaneoVersion: Option.Option<string>;
    readonly cliDir: string | null;
  }) {
    const packageName = yield* Effect.fromResult(
      parsePackageName(options.packageName),
    );
    const projectDir = yield* resolvePluginProject(options.project);
    const target = yield* resolvePluginTarget({
      kaneoVersion: options.kaneoVersion,
      projectDir,
      cliDir: options.cliDir,
    });
    const release = yield* pickRelease({
      projectDir,
      packageName,
      kaneoVersion: target.version,
    });
    yield* humanNote((ui) => [
      `  ${ui.theme.muted(`Picked ${packageName}@${release.version}, which supports Kaneo ${release.range}.`)}`,
    ]);
    const catalog = yield* confirmCatalog(packageName, options.yes);
    const installed = yield* installPlugin({
      projectDir,
      packageName,
      version: release.version,
      kaneoVersion: target.version,
    });
    const config = yield* Effect.tryPromise({
      try: () => updateConfigFile(projectDir, packageName),
      catch: (error) =>
        new InvalidArgument({
          message: `${packageName} was installed, but the config file could not be updated: ${errorMessage(error)}`,
          hint: `Add ${packageName} to kaneo.config.ts yourself, then run kaneo plugin check.`,
        }),
    });

    const result: PluginAddResult = {
      packageName,
      version: release.version,
      range: release.range,
      kaneoVersion: target.version,
      kaneoVersionSource: target.source,
      catalog,
      projectDir,
      installed: installed.specs,
      createdPackageJson: installed.createdPackageJson,
      config,
    };
    yield* emit(result, renderPluginAdd);
  },
);

export const pluginAdd = Command.make(
  "add",
  {
    packageName: Argument.String("package").pipe(
      Argument.withDescription(
        "npm package of the plugin, without a version, for example kaneo-plugin-task-progress",
      ),
    ),
    yes: Flag.Boolean("yes").pipe(
      Flag.withAlias("y"),
      Flag.withDescription(
        "Add a package that is not in the Kaneo plugin catalog without asking",
      ),
      Flag.withDefault(false),
    ),
    project: projectDirFlag,
    kaneoVersion: kaneoVersionFlag,
  },
  (options) => runPluginAdd({ ...options, cliDir: CLI_DIR }),
).pipe(
  Command.withDescription(
    "Install the newest release of a plugin that supports your Kaneo and add it to kaneo.config.ts",
  ),
  Command.provide(Layer.mergeAll(NpmLive, PluginCatalogLive)),
);
