import { stat } from "node:fs/promises";
import { join } from "node:path";
import type { BuiltFile } from "./build-result.js";
import { listFiles } from "./list-files.js";

export async function listBuiltFiles(root: string): Promise<BuiltFile[]> {
  const files = await listFiles(root, "dist");
  return Promise.all(
    files.map(async (path) => ({
      path,
      bytes: (await stat(join(root, path))).size,
    })),
  );
}
