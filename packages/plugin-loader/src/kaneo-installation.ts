import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";

export type KaneoInstallation = {
  root: string;
  version: string;
};

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

export function findKaneoInstallation(
  startDir: string,
): KaneoInstallation | null {
  let dir = startDir;
  while (true) {
    const pkg = readPackageJson(join(dir, "package.json"));
    if (pkg?.name === "kaneo" && typeof pkg.version === "string") {
      return { root: dir, version: pkg.version };
    }
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
