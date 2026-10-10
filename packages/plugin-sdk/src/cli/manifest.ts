import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parsePluginPackage } from "../package/parse-plugin-package.js";
import type { PluginPackage } from "../package/parse-plugin-package.js";
import { errorMessage } from "./errors/error-message.js";
import { PackageJsonInvalid, PackageJsonMissing } from "./errors/errors.js";

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
    throw new PackageJsonMissing({ root });
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(source);
  } catch (error) {
    throw new PackageJsonInvalid({
      message: `package.json is not valid JSON: ${errorMessage(error)}`,
    });
  }
  if (!isRecord(parsed)) {
    throw new PackageJsonInvalid({ message: "package.json is not an object" });
  }
  return parsed;
}

export async function readManifest(root: string): Promise<Manifest> {
  const packageJson = await readPackageJson(root);
  const result = parsePluginPackage(packageJson);
  if (!result.ok) {
    throw new PackageJsonInvalid({ message: `package.json: ${result.error}` });
  }
  if (packageJson.type !== "module") {
    throw new PackageJsonInvalid({
      message:
        'package.json must set "type": "module" because the bundles are ES modules',
    });
  }
  if (!isRecord(packageJson.exports) || !packageJson.exports["."]) {
    throw new PackageJsonInvalid({
      message:
        'package.json must export "." so kaneo.config.ts can import the plugin factory',
    });
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
