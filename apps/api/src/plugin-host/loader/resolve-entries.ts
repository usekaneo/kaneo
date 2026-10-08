import { realpath, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { PluginPackage } from "@kaneo/plugin-sdk";
import { isInsideDirectory } from "../is-inside-directory";
import type { PluginWebAssets } from "../types";
import { StageError } from "./stage-error";

const WEB_ENTRY_EXTENSIONS = new Set([".js", ".mjs"]);

export type ResolvedEntries = {
  root: string;
  server: string | null;
  web: PluginWebAssets | null;
};

async function isFile(path: string): Promise<boolean> {
  try {
    return (await stat(path)).isFile();
  } catch {
    return false;
  }
}

async function resolveEntryFile(
  root: string,
  key: string,
  entry: string,
): Promise<string> {
  let real: string;
  try {
    real = await realpath(resolve(root, entry));
  } catch {
    throw new StageError(
      `Export "${key}" points to ${entry}, which does not exist.`,
    );
  }
  if (!isInsideDirectory(root, real)) {
    throw new StageError(
      `Export "${key}" points to ${real}, which is outside the package.`,
    );
  }
  if (!(await isFile(real))) {
    throw new StageError(
      `Export "${key}" points to ${entry}, which is not a file.`,
    );
  }
  return real;
}

async function resolveWebAssets(
  entry: string,
  server: string | null,
): Promise<PluginWebAssets> {
  const extension = extname(entry);
  if (!WEB_ENTRY_EXTENSIONS.has(extension)) {
    throw new StageError(
      `Export "./web" must point to a .js or .mjs file, not ${basename(entry)}.`,
    );
  }
  const root = dirname(entry);
  const styles = `${basename(entry, extension)}.css`;
  return {
    root,
    entry: basename(entry),
    styles: (await isFile(join(root, styles))) ? styles : null,
    excluded: server ? [server] : [],
  };
}

export async function resolveEntries(
  packageRoot: string,
  plugin: PluginPackage,
): Promise<ResolvedEntries> {
  const root = await realpath(packageRoot);
  const server = plugin.server
    ? await resolveEntryFile(root, "./server", plugin.server)
    : null;
  const web = plugin.web
    ? await resolveWebAssets(
        await resolveEntryFile(root, "./web", plugin.web),
        server,
      )
    : null;
  return { root, server, web };
}
