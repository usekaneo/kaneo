import { existsSync, statSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { getKaneoVersion } from "../plugin-host/kaneo-version";
import { errorMessage, PluginLoadError } from "../plugin-host/load-error";
import { CliError } from "./cli-error";
import { helpText } from "./help";
import type { Output } from "./io";
import { type CliCommand, parseCli } from "./parse-cli";
import { resolveProjectDir } from "./project-dir";
import { resolveConfigPath } from "./resolve-config-path";
import { terminalPrompt } from "./terminal-prompt";

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function projectDirFor(flag: string | undefined): string {
  const dir = resolveProjectDir({
    flag,
    env: process.env.KANEO_PROJECT_DIR,
    cwd: process.cwd(),
    exists: existsSync,
  });
  if (!isDirectory(dir)) {
    throw new CliError(`The project directory ${dir} does not exist.`);
  }
  return dir;
}

function configPathFor(
  flag: string | undefined,
  projectDir: string,
): string | null {
  return resolveConfigPath({
    flag,
    env: process.env.KANEO_CONFIG,
    cwd: process.cwd(),
    projectDir,
    exists: existsSync,
  });
}

const CLI_DIR = dirname(fileURLToPath(import.meta.url));

async function run(command: CliCommand, output: Output): Promise<number> {
  switch (command.name) {
    case "help":
      output.log(helpText(command.topic));
      return 0;
    case "version": {
      const version = getKaneoVersion(CLI_DIR);
      if (!version) {
        throw new CliError(
          "Kaneo could not determine its version. Set KANEO_VERSION.",
        );
      }
      output.log(version);
      return 0;
    }
    case "check": {
      const { runCheck } = await import("./commands/check");
      const projectDir = projectDirFor(command.project);
      return runCheck(
        {
          projectDir,
          configPath: configPathFor(command.config, projectDir),
          kaneoVersion: getKaneoVersion(CLI_DIR),
        },
        output,
      );
    }
    case "add": {
      const [{ runAdd }, { withNpm }, { catalogUrl, lookupCatalog }] =
        await Promise.all([
          import("./commands/add/run-add"),
          import("./commands/add/npm"),
          import("./commands/add/lookup-catalog"),
        ]);
      const projectDir = projectDirFor(command.project);
      return withNpm(projectDir, (npm) =>
        runAdd(
          {
            packageName: command.packageName,
            yes: command.yes,
            projectDir,
            kaneoVersion: getKaneoVersion(CLI_DIR),
          },
          {
            output,
            prompt: terminalPrompt(),
            npm,
            lookupCatalog: (packageName) =>
              lookupCatalog(packageName, { url: catalogUrl(process.env) }),
          },
        ),
      );
    }
    case "purge": {
      const [{ runPurge }, { countPluginData, deletePluginData }] =
        await Promise.all([
          import("./commands/purge/run-purge"),
          import("../plugin-host/data/plugin-data"),
        ]);
      const projectDir = projectDirFor(command.project);
      return runPurge(
        {
          pluginId: command.pluginId,
          yes: command.yes,
          configPath: configPathFor(command.config, projectDir),
        },
        {
          output,
          prompt: terminalPrompt(),
          countData: countPluginData,
          deleteData: deletePluginData,
        },
      );
    }
  }
}

export async function main(
  argv: readonly string[],
  output: Output = console,
): Promise<number> {
  try {
    return await run(parseCli(argv), output);
  } catch (error) {
    output.error(
      error instanceof PluginLoadError ? error.format() : errorMessage(error),
    );
    return 1;
  }
}
