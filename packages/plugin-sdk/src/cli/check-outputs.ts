import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { isBuiltin } from "node:module";
import { join } from "node:path";
import { SHARED_MODULES } from "../shared-modules.js";
import type { PluginEntries } from "./entries.js";
import { listExportTargets } from "./export-targets.js";
import { listFiles } from "./list-files.js";
import type { Manifest } from "./manifest.js";
import {
  findModuleSpecifiers,
  isRelativeSpecifier,
  isUrlSpecifier,
} from "./module-specifiers.js";

const sharedModules = new Set<string>(SHARED_MODULES);

export type BuildIssues = {
  errors: string[];
  warnings: string[];
};

function checkExports(
  root: string,
  manifest: Manifest,
  typesEmitted: boolean,
  issues: BuildIssues,
) {
  for (const { key, target } of listExportTargets(
    manifest.packageJson.exports,
  )) {
    if (existsSync(join(root, target))) continue;
    const message = `Export "${key}" points to ${target}, which the build did not produce`;
    if (target.endsWith(".d.ts") && !typesEmitted)
      issues.warnings.push(message);
    else issues.errors.push(message);
  }
}

function checkEntries(
  manifest: Manifest,
  entries: PluginEntries,
  issues: BuildIssues,
) {
  const { plugin } = manifest;
  if (entries.server && !plugin.server) {
    issues.warnings.push(
      'src/server.ts was built, but package.json has no "./server" export, so Kaneo will not load it',
    );
  }
  if (entries.web && !plugin.web) {
    issues.warnings.push(
      'The web entry was built, but package.json has no "./web" export, so Kaneo will not load it',
    );
  }
  if (!plugin.engines) {
    issues.warnings.push(
      'package.json has no "engines.kaneo" range, so Kaneo cannot check compatibility. Add one, for example ">=2.29 <3"',
    );
  }
}

function importError(file: string, specifier: string): string {
  if (file.startsWith("dist/web/")) {
    return `${file} imports "${specifier}", which Kaneo's web app does not provide. Bundle it, or import only these shared modules: ${SHARED_MODULES.join(", ")}`;
  }
  return `${file} imports "${specifier}". Server bundles must be self-contained, so do not mark packages as external in vite.config`;
}

async function checkBundleImports(root: string, issues: BuildIssues) {
  for (const file of await listFiles(root, "dist")) {
    if (!/\.m?js$/.test(file)) continue;
    const isWeb = file.startsWith("dist/web/");
    const code = await readFile(join(root, file), "utf8");
    for (const specifier of findModuleSpecifiers(code)) {
      if (isRelativeSpecifier(specifier) || isUrlSpecifier(specifier)) continue;
      if (isWeb ? sharedModules.has(specifier) : isBuiltin(specifier)) continue;
      issues.errors.push(importError(file, specifier));
    }
  }
}

export async function checkOutputs(
  root: string,
  manifest: Manifest,
  entries: PluginEntries,
  typesEmitted: boolean,
): Promise<BuildIssues> {
  const issues: BuildIssues = { errors: [], warnings: [] };
  checkExports(root, manifest, typesEmitted, issues);
  checkEntries(manifest, entries, issues);
  await checkBundleImports(root, issues);
  return issues;
}
