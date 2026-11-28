import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginDescriptor } from "@kaneo/plugin-sdk";

const created: string[] = [];

export async function createTempDir(): Promise<string> {
  const dir = await realpath(
    await mkdtemp(join(tmpdir(), "kaneo-plugin-loader-")),
  );
  created.push(dir);
  return dir;
}

export async function removeTempDirs(): Promise<void> {
  await Promise.all(
    created.splice(0).map((dir) => rm(dir, { recursive: true, force: true })),
  );
}

export async function writeFiles(
  root: string,
  files: Record<string, string>,
): Promise<void> {
  for (const [path, content] of Object.entries(files)) {
    const target = join(root, path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content);
  }
}

export const SERVER_ENTRY =
  "export default { kind: 'kaneo-server', apiVersion: 1, settings: {}, setup() {} };\n";

export const FACTORY_ENTRY =
  "export default () => ({ kind: 'kaneo-plugin', apiVersion: 1, url: import.meta.url, options: undefined, schema: null });\n";

export type PluginPackageOptions = {
  name?: string;
  version?: string;
  engines?: string | null;
  kaneo?: Record<string, unknown>;
  exports?: Record<string, unknown>;
  files?: Record<string, string>;
  dir?: string;
};

export async function writePluginPackage(
  options: PluginPackageOptions = {},
): Promise<{ dir: string; root: string; url: string }> {
  const dir = options.dir ?? (await createTempDir());
  const name = options.name ?? "kaneo-plugin-progress";
  const root = join(dir, "node_modules", ...name.split("/"));
  const packageJson = {
    name,
    version: options.version ?? "1.2.0",
    type: "module",
    ...(options.engines === null
      ? {}
      : { engines: { kaneo: options.engines ?? ">=2.29.0 <3" } }),
    exports: options.exports ?? {
      ".": "./dist/index.js",
      "./server": "./dist/server.js",
      "./web": "./dist/web/index.js",
    },
    ...(options.kaneo ? { kaneo: options.kaneo } : {}),
  };
  await writeFiles(root, {
    "package.json": JSON.stringify(packageJson),
    "dist/index.js": FACTORY_ENTRY,
    "dist/server.js": SERVER_ENTRY,
    "dist/web/index.js": "export default {};\n",
    ...options.files,
  });
  return { dir, root, url: pathToFileURL(join(root, "dist/index.js")).href };
}

export function descriptor(
  url: string,
  options: unknown = undefined,
): PluginDescriptor {
  return { kind: "kaneo-plugin", apiVersion: 1, url, options, schema: null };
}

export function configSource(urls: readonly string[], extra = ""): string {
  const plugins = urls.map((url) => JSON.stringify(descriptor(url))).join(", ");
  return `export default { ${extra} plugins: [${plugins}] };\n`;
}
