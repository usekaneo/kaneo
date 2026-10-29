import { realpath, stat } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import type { PluginPackage } from "@kaneo/plugin-sdk";
import { isInsideDirectory } from "../is-inside-directory.js";
import type { PluginWebAssets } from "../types.js";
import { StageError } from "./stage-error.js";

const WEB_ENTRY_EXTENSIONS = new Set([".js", ".mjs"]);

const SHARED_WEB_FOLDER_HINT =
  "Report this to the plugin's author. Plugins built with kaneo-plugin build keep the web entry in dist/web/.";

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

async function realFile(path: string): Promise<string> {
  try {
    return await realpath(path);
  } catch {
    return resolve(path);
  }
}

function serverCodeInWebFolder(
  webRoot: string,
  server: string | null,
  factory: string,
): string | null {
  if (server && isInsideDirectory(webRoot, server)) {
    return "./server is inside it";
  }
  if (isInsideDirectory(webRoot, factory)) {
    return 'the "." entry is inside it';
  }
  return null;
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
  factory: string,
): Promise<PluginWebAssets> {
  const extension = extname(entry);
  if (!WEB_ENTRY_EXTENSIONS.has(extension)) {
    throw new StageError(
      `Export "./web" must point to a .js or .mjs file, not ${basename(entry)}.`,
    );
  }
  const root = dirname(entry);
  const serverCode = serverCodeInWebFolder(root, server, factory);
  if (serverCode) {
    throw new StageError(
      `Move the ./web export into its own folder; the web folder must not contain server code (${serverCode}).`,
      SHARED_WEB_FOLDER_HINT,
    );
  }
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
  factory: string,
): Promise<ResolvedEntries> {
  const root = await realpath(packageRoot);
  const server = plugin.server
    ? await resolveEntryFile(root, "./server", plugin.server)
    : null;
  const web = plugin.web
    ? await resolveWebAssets(
        await resolveEntryFile(root, "./web", plugin.web),
        server,
        await realFile(factory),
      )
    : null;
  return { root, server, web };
}
