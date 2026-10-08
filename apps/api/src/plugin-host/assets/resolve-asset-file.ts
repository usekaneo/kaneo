import { realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import { isInsideDirectory } from "../is-inside-directory";
import type { PluginWebAssets } from "../types";

export type AssetFile = {
  path: string;
  size: number;
  mtimeMs: number;
};

export async function resolveAssetFile(
  web: PluginWebAssets,
  segments: readonly string[],
): Promise<AssetFile | null> {
  let real: string;
  try {
    real = await realpath(join(web.root, ...segments));
  } catch {
    return null;
  }
  if (!isInsideDirectory(web.root, real) || web.excluded.includes(real)) {
    return null;
  }
  const info = await stat(real);
  return info.isFile()
    ? { path: real, size: info.size, mtimeMs: info.mtimeMs }
    : null;
}
