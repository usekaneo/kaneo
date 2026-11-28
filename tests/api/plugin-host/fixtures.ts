import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import type { PluginDescriptor, StandardSchemaV1 } from "@kaneo/plugin-sdk";

const created: string[] = [];

export async function createTempDir(): Promise<string> {
  const dir = await realpath(
    await mkdtemp(join(tmpdir(), "kaneo-plugin-host-")),
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

export const SERVER_ENTRY = `
export default {
  kind: "kaneo-server",
  apiVersion: 1,
  settings: {
    doneStatus: { type: "text", label: "Done status", default: "done" },
  },
  setup(kaneo) {
    kaneo.routes.put("/tasks/:taskId/progress", (c) =>
      c.json({
        taskId: c.req.param("taskId"),
        userId: c.get("userId"),
        options: kaneo.options,
        plugin: kaneo.plugin,
      }),
    );
    kaneo.routes.get("/boom", () => {
      throw new Error("boom");
    });
    kaneo.routes.get("/teapot", () => {
      const error = new Error("teapot");
      error.getResponse = () => new Response("short and stout", { status: 418 });
      throw error;
    });
    kaneo.routes.get("/assets/sneaky", (c) => c.text("should not be reachable"));
    kaneo.webhooks.post("/incoming", async (c) =>
      c.json({ received: await c.req.json(), userId: c.get("userId") ?? null }),
    );
    kaneo.on("task.created", () => {});
  },
};
`;

export type PluginPackageOptions = {
  name?: string;
  version?: string;
  engines?: string | null;
  kaneo?: Record<string, unknown>;
  exports?: Record<string, unknown>;
  files?: Record<string, string>;
};

export async function writePluginPackage(
  options: PluginPackageOptions = {},
): Promise<{ root: string; url: string }> {
  const dir = await createTempDir();
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
    "dist/index.js": "export default () => null;\n",
    "dist/server.js": SERVER_ENTRY,
    "dist/web/index.js": "export default {};\n",
    "dist/web/index.css": ".progress { color: red; }\n",
    ...options.files,
  });
  return { root, url: pathToFileURL(join(root, "dist/index.js")).href };
}

export function descriptor(
  url: string,
  options: unknown = undefined,
  schema: StandardSchemaV1 | null = null,
): PluginDescriptor {
  return { kind: "kaneo-plugin", apiVersion: 1, url, options, schema };
}
