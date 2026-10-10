import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  findKaneoInstallation,
  type KaneoInstallation,
} from "@kaneo/plugin-loader";

export type Installation = KaneoInstallation & {
  readonly officialBaseDir: string | null;
};

export function findInstallation(
  searchDirs: ReadonlyArray<string | null>,
  exists: (path: string) => boolean = existsSync,
): Installation | null {
  for (const dir of searchDirs) {
    const found = dir ? findKaneoInstallation(dir) : null;
    if (!found) continue;
    const apiDir = join(found.root, "apps", "api");
    return {
      ...found,
      officialBaseDir: exists(join(apiDir, "package.json")) ? apiDir : null,
    };
  }
  return null;
}
