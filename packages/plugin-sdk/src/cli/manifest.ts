import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePluginPackage } from "../package/parse-plugin-package.js";
import type { PluginPackage } from "../package/parse-plugin-package.js";
import { CliError } from "./errors.js";

export type PackageJson = Record<string, unknown>;

export type Manifest = {
  packageJson: PackageJson;
  plugin: PluginPackage;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

async function readPackageJson(root: string): Promise<PackageJson> {
  let source: string;
  try {
    source = await readFile(join(root, "package.json"), "utf8");
  } catch {
    throw new CliError(
      `No package.json in ${root}. Run kaneo-plugin build from the plugin's root folder.`,
    );
  }
  const parsed: unknown = JSON.parse(source);
  if (!isRecord(parsed)) throw new CliError("package.json is not an object");
  return parsed;
}

export async function readManifest(root: string): Promise<Manifest> {
  const packageJson = await readPackageJson(root);
  const result = parsePluginPackage(packageJson);
  if (!result.ok) throw new CliError(`package.json: ${result.error}`);
  if (packageJson.type !== "module") {
    throw new CliError(
      'package.json must set "type": "module" because the bundles are ES modules',
    );
  }
  if (!isRecord(packageJson.exports) || !packageJson.exports["."]) {
    throw new CliError(
      'package.json must export "." so kaneo.config.ts can import the plugin factory',
    );
  }
  return { packageJson, plugin: result.plugin };
}

export function declaredPackages(packageJson: PackageJson): Set<string> {
  const names = new Set<string>();
  for (const field of [
    "dependencies",
    "peerDependencies",
    "optionalDependencies",
  ]) {
    const value = packageJson[field];
    if (isRecord(value)) for (const name of Object.keys(value)) names.add(name);
  }
  return names;
}
