import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

let cached: string | null | undefined;

function readPackageJson(path: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    return typeof parsed === "object" && parsed !== null
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function findKaneoVersion(startDir: string): string | null {
  let dir = startDir;
  while (true) {
    const pkg = readPackageJson(join(dir, "package.json"));
    if (pkg?.name === "kaneo" && typeof pkg.version === "string") {
      return pkg.version;
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function getKaneoVersion(startDir?: string): string | null {
  if (cached === undefined) {
    cached =
      process.env.KANEO_VERSION?.trim() ||
      findKaneoVersion(startDir ?? process.cwd());
  }
  return cached;
}
