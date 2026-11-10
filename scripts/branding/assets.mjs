import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, lstat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { brand } from "../../branding/index.cjs";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const assetRoots = [
  "apps/web/public",
  "apps/site/public",
  "apps/docs",
  "apps/mobile/assets",
];
export const media =
  /\.(svg|png|jpe?g|gif|webp|avif|ico|mp4|webm|mov|pdf|zip)$/i;

export async function filesUnder(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink())
      throw new Error(`Unreviewable symbolic link: ${full}`);
    if (entry.isDirectory()) result.push(...(await filesUnder(full)));
    else if (entry.isFile()) result.push(full);
  }
  return result;
}

export function digest(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

export function safePath(base, relative) {
  const full = path.resolve(base, relative);
  if (
    full === path.resolve(base) ||
    !full.startsWith(path.resolve(base) + path.sep)
  ) {
    throw new Error(`Path escapes asset directory: ${relative}`);
  }
  return full;
}

export async function safeCacheOutput(output) {
  const cache = path.join(root, ".cache");
  const target = safePath(cache, path.relative(cache, output));
  for (let current = target; ; current = path.dirname(current)) {
    try {
      if ((await lstat(current)).isSymbolicLink())
        throw new Error(`Symbolic link in output path: ${current}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (current === cache) return target;
  }
}

export async function applyAssets(surface, output) {
  for (const asset of brand.assets.filter((item) =>
    item.target.startsWith(surface + "/"),
  )) {
    const source = safePath(path.join(root, "branding"), asset.source);
    if (!asset.approved || digest(await readFile(source)) !== asset.sha256) {
      throw new Error(`Unapproved or changed replacement: ${asset.source}`);
    }
    const target = safePath(output, asset.target.slice(surface.length + 1));
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(source, target);
  }
}
