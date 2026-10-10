import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

function resolveFrom(baseDir: string, packageName: string): string {
  try {
    return createRequire(join(baseDir, "package.json")).resolve(packageName);
  } catch {
    throw new Error(`Cannot find package '${packageName}' from ${baseDir}.`);
  }
}

export async function importOfficialFactory(
  packageName: string,
  baseDir: string,
): Promise<{ default?: unknown }> {
  return import(pathToFileURL(resolveFrom(baseDir, packageName)).href);
}
