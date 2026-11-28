import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type PluginPackage, parsePluginPackage } from "@kaneo/plugin-sdk";
import { errorMessage } from "../load-error.js";
import { StageError } from "./stage-error.js";

export type ResolvedPackage = {
  root: string;
  plugin: PluginPackage;
  factory: string;
};

async function readPackageJson(path: string): Promise<unknown> {
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw error;
  }
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new StageError(`${path} is not valid JSON: ${errorMessage(error)}`);
  }
}

function hasName(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { name?: unknown }).name === "string"
  );
}

function toFilePath(url: string): string {
  try {
    return fileURLToPath(url);
  } catch {
    throw new StageError(
      `The plugin was defined with ${url}, which is not a file URL.`,
      "The plugin must call definePlugin(import.meta.url) from a file inside its package. Report this to its author.",
    );
  }
}

export async function resolvePackage(url: string): Promise<ResolvedPackage> {
  const file = toFilePath(url);
  let dir = dirname(file);
  while (true) {
    const path = join(dir, "package.json");
    const packageJson = await readPackageJson(path);
    if (hasName(packageJson)) {
      const parsed = parsePluginPackage(packageJson);
      if (!parsed.ok) {
        throw new StageError(`${parsed.error} (${path}).`);
      }
      return { root: dir, plugin: parsed.plugin, factory: file };
    }
    const parent = dirname(dir);
    if (parent === dir) {
      throw new StageError(`No package.json was found above ${file}.`);
    }
    dir = parent;
  }
}
