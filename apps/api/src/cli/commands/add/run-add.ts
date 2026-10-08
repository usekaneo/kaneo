import { basename } from "node:path";
import { CliError } from "../../cli-error";
import type { Output, Prompt } from "../../io";
import type { CatalogLookup } from "./lookup-catalog";
import type { Npm } from "./npm";
import { parsePackageName } from "./package-name";
import { ensureProjectPackage } from "./project-package";
import { type VersionChoice, selectVersion } from "./select-version";
import { type ConfigUpdate, updateConfigFile } from "./update-config-file";

export type AddInput = {
  packageName: string;
  yes: boolean;
  projectDir: string;
  kaneoVersion: string | null;
};

export type AddDependencies = {
  output: Output;
  prompt: Prompt;
  npm: Npm;
  lookupCatalog: (packageName: string) => Promise<CatalogLookup>;
};

function versionError(
  packageName: string,
  kaneoVersion: string,
  choice: Exclude<VersionChoice, { status: "ok" }>,
): CliError {
  switch (choice.status) {
    case "no-stable":
      return new CliError(`${packageName} has no stable release on npm.`);
    case "all-deprecated":
      return new CliError(
        `Every release of ${packageName} is deprecated, including the newest, ${choice.newest}.`,
      );
    case "no-engines":
      return new CliError(
        `No release of ${packageName} declares engines.kaneo, so kaneo add cannot tell which one supports Kaneo ${kaneoVersion}. Ask the plugin's author to add engines.kaneo to package.json. To use it anyway, install it with npm, add it to kaneo.config.ts yourself, and run kaneo check.`,
      );
    case "incompatible":
      return new CliError(
        `No release of ${packageName} supports Kaneo ${kaneoVersion}. The newest, ${choice.newest}, supports Kaneo ${choice.range}.`,
      );
  }
}

async function confirmUnlisted(
  packageName: string,
  catalog: CatalogLookup,
  { yes, output, prompt }: { yes: boolean; output: Output; prompt: Prompt },
): Promise<boolean> {
  if (catalog.status === "listed") {
    output.log(`${packageName} is listed in the Kaneo plugin catalog.`);
    return true;
  }
  output.error(
    catalog.status === "unlisted"
      ? `warn  ${packageName} is not listed in the Kaneo plugin catalog. Plugins run with full access to Kaneo, so only add packages you trust.`
      : `warn  Could not check the Kaneo plugin catalog: ${catalog.reason}. Only add packages you trust.`,
  );
  if (yes) return true;
  if (!prompt.interactive) {
    throw new CliError(`Run kaneo add ${packageName} --yes to add it anyway.`);
  }
  const answer = await prompt.ask(`Add ${packageName} anyway? [y/N] `);
  return /^y(?:es)?$/i.test(answer);
}

function reportConfig(
  update: ConfigUpdate,
  packageName: string,
  output: Output,
): void {
  const name = basename(update.file);
  switch (update.status) {
    case "created":
      output.log(`Created ${name} with ${update.importName}() in plugins.`);
      return;
    case "updated":
      output.log(`Added ${update.importName}() to plugins in ${name}.`);
      return;
    case "present":
      output.log(
        `${name} already imports ${packageName}, so it was left as is.`,
      );
      return;
    case "manual":
      output.error(
        [
          `Could not update ${name} safely: ${update.reason}. It was left as is. Add the plugin yourself:`,
          "",
          `  import ${update.importName} from "${packageName}";`,
          "",
          `Then add ${update.importName}() to the plugins array in defineConfig({ ... }), or add plugins: [${update.importName}()] if there is none.`,
        ].join("\n"),
      );
  }
}

export async function runAdd(
  input: AddInput,
  { output, prompt, npm, lookupCatalog }: AddDependencies,
): Promise<number> {
  const packageName = parsePackageName(input.packageName);
  const { kaneoVersion, projectDir } = input;
  if (!kaneoVersion) {
    throw new CliError(
      "Kaneo could not determine its own version, so it cannot pick a compatible release. Set KANEO_VERSION and try again.",
    );
  }

  output.log(`Looking up ${packageName} with npm...`);
  const releases = await npm.releases(packageName);
  if (!releases.ok) {
    throw new CliError(
      `npm could not look up ${packageName}: ${releases.message}`,
    );
  }
  const choice = selectVersion(releases.releases, kaneoVersion);
  if (choice.status !== "ok") {
    throw versionError(packageName, kaneoVersion, choice);
  }
  output.log(
    `Picked ${packageName}@${choice.version}, which supports Kaneo ${choice.range}.`,
  );

  const confirmed = await confirmUnlisted(
    packageName,
    await lookupCatalog(packageName),
    { yes: input.yes, output, prompt },
  );
  if (!confirmed) {
    output.error("Cancelled. Nothing was changed.");
    return 1;
  }

  const project = await ensureProjectPackage(projectDir);
  if (project.created) output.log(`Created package.json in ${projectDir}.`);
  const specs = [`${packageName}@${choice.version}`];
  if (!project.hasConfigPackage) specs.push(`@kaneo/config@${kaneoVersion}`);

  output.log(`Running npm install --save-exact ${specs.join(" ")}`);
  if (!(await npm.install(specs))) {
    throw new CliError(
      "npm install failed, see its output above. kaneo.config.ts was not changed.",
    );
  }
  output.log(`Installed ${specs.join(" and ")}.`);

  const update = await updateConfigFile(projectDir, packageName);
  reportConfig(update, packageName, output);
  output.log(
    `Next: check the options ${packageName} accepts in its README and pass them in kaneo.config.ts, then run kaneo check and restart Kaneo. Workspace admins turn it on in Settings → Workspace → Plugins.`,
  );
  return 0;
}
