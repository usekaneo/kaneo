import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";

const created: string[] = [];

export async function createTempDir(): Promise<string> {
  const dir = await realpath(await mkdtemp(join(tmpdir(), "kaneo-cli-")));
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

const FACTORY =
  "export default () => ({ kind: 'kaneo-plugin', apiVersion: 1, url: import.meta.url, options: undefined, schema: null });\n";

const SERVER =
  "export default { kind: 'kaneo-server', apiVersion: 1, settings: {}, setup() {} };\n";

export async function writePluginPackage(
  dir: string,
  options: {
    name: string;
    version?: string;
    engines?: string;
    id?: string;
    server?: string;
  },
): Promise<string> {
  const root = join(dir, "node_modules", ...options.name.split("/"));
  await writeFiles(root, {
    "package.json": JSON.stringify({
      name: options.name,
      version: options.version ?? "1.0.0",
      type: "module",
      engines: { kaneo: options.engines ?? ">=2.29.0 <3" },
      exports: { ".": "./dist/index.js", "./server": "./dist/server.js" },
      ...(options.id ? { kaneo: { id: options.id } } : {}),
    }),
    "dist/index.js": FACTORY,
    "dist/server.js": options.server ?? SERVER,
  });
  return pathToFileURL(join(root, "dist/index.js")).href;
}

export function configSource(urls: readonly string[], extra = ""): string {
  const plugins = urls
    .map(
      (url) =>
        `{ kind: "kaneo-plugin", apiVersion: 1, url: ${JSON.stringify(url)}, options: undefined, schema: null }`,
    )
    .join(", ");
  return `export default { ${extra} plugins: [${plugins}] };\n`;
}

export async function writeInstallation(version: string): Promise<string> {
  const root = await createTempDir();
  await writeFiles(root, {
    "package.json": JSON.stringify({ name: "kaneo", version }),
    "apps/api/package.json": JSON.stringify({ name: "@kaneo/api" }),
    "packages/cli/dist/kaneo.mjs": "",
  });
  return root;
}
