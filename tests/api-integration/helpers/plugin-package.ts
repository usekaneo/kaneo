import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginDescriptor } from "@kaneo/plugin-sdk";

export async function writePluginPackage(
  name: string,
  serverSource: string,
): Promise<{ dir: string; descriptor: PluginDescriptor }> {
  const dir = await realpath(
    await mkdtemp(join(tmpdir(), "kaneo-plugin-integration-")),
  );
  const root = join(dir, "node_modules", name);
  const files: Record<string, string> = {
    "package.json": JSON.stringify({
      name,
      version: "1.0.0",
      type: "module",
      engines: { kaneo: ">=2.0.0" },
      exports: {
        ".": "./dist/index.js",
        "./server": "./dist/server.js",
        "./web": "./dist/web/index.js",
      },
    }),
    "dist/index.js": "export default () => null;\n",
    "dist/server.js": serverSource,
    "dist/web/index.js": "export default {};\n",
  };
  for (const [path, content] of Object.entries(files)) {
    await mkdir(dirname(join(root, path)), { recursive: true });
    await writeFile(join(root, path), content);
  }
  return {
    dir,
    descriptor: {
      kind: "kaneo-plugin",
      apiVersion: 1,
      url: pathToFileURL(join(root, "dist/index.js")).href,
      options: undefined,
      schema: null,
    },
  };
}

export async function removePluginPackage(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
