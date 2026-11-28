import { readdir } from "node:fs/promises";
import { join, relative, sep } from "node:path";

export async function listFiles(root: string, dir: string): Promise<string[]> {
  const entries = await readdir(join(root, dir), {
    recursive: true,
    withFileTypes: true,
  }).catch(() => []);
  return entries
    .filter((entry) => entry.isFile())
    .map((entry) =>
      relative(root, join(entry.parentPath, entry.name)).split(sep).join("/"),
    )
    .sort();
}
