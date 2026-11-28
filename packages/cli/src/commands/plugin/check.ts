import { existsSync } from "node:fs";
import { Effect, Option } from "effect";
import { Command, Flag } from "effect/cli";
import { emit } from "../../output/emit.js";
import { withSpinner } from "../../output/spinner.js";
import { checkProject } from "../../plugins/check-project.js";
import { CLI_DIR } from "../../plugins/cli-dir.js";
import { resolveConfigPath } from "../../plugins/config-path.js";
import { resolvePluginProject } from "../../plugins/plugin-project.js";
import { resolvePluginTarget } from "../../plugins/plugin-target.js";
import { renderPluginCheck } from "../../plugins/render-plugin-check.js";
import { CliEnvironment } from "../../services/cli-environment.js";
import { kaneoVersionFlag, projectDirFlag } from "./flags.js";

export const runPluginCheck = Effect.fn("command.plugin.check")(
  function* (options: {
    readonly project: Option.Option<string>;
    readonly config: Option.Option<string>;
    readonly kaneoVersion: Option.Option<string>;
    readonly cliDir: string | null;
  }) {
    const environment = yield* CliEnvironment;
    const projectDir = yield* resolvePluginProject(options.project);
    const configPath = yield* Effect.fromResult(
      resolveConfigPath({
        flag: Option.getOrUndefined(options.config),
        cwd: environment.cwd,
        projectDir,
        exists: existsSync,
      }),
    );
    const target = yield* resolvePluginTarget({
      kaneoVersion: options.kaneoVersion,
      projectDir,
      cliDir: options.cliDir,
    });
    const report = yield* withSpinner("Checking plugins")(
      checkProject({ projectDir, configPath, target }),
    );
    yield* emit(report, renderPluginCheck);
    if (report.failed > 0) {
      yield* Effect.sync(() => {
        process.exitCode = 1;
      });
    }
  },
);

export const pluginCheck = Command.make(
  "check",
  {
    project: projectDirFlag,
    config: Flag.String("config").pipe(
      Flag.withDescription(
        "Config file to check (default: kaneo.config.ts, .js or .mjs in the project folder)",
      ),
      Flag.optional,
    ),
    kaneoVersion: kaneoVersionFlag,
  },
  (options) => runPluginCheck({ ...options, cliDir: CLI_DIR }),
).pipe(
  Command.withDescription(
    "Run the plugin startup checks without starting Kaneo or touching the database",
  ),
);
