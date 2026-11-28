import { findKaneoInstallation } from "./kaneo-installation.js";

let cached: string | null | undefined;

export function findKaneoVersion(startDir: string): string | null {
  return findKaneoInstallation(startDir)?.version ?? null;
}

export function getKaneoVersion(startDir?: string): string | null {
  if (cached === undefined) {
    cached =
      process.env.KANEO_VERSION?.trim() ||
      findKaneoVersion(startDir ?? process.cwd());
  }
  return cached;
}
