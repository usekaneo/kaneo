import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { stopPluginJobs } from "../../../apps/api/src/plugin-host/context/plugin-jobs";
import { PluginLoadError } from "../../../apps/api/src/plugin-host/load-error";
import { loadPlugins } from "../../../apps/api/src/plugin-host/loader/load-plugins";
import {
  clearLoadedPlugins,
  getLoadedPlugin,
} from "../../../apps/api/src/plugin-host/registry";
import { dispatchPluginRoute } from "../../../apps/api/src/plugin-host/routes/dispatch-plugin-route";
import { dispatchPluginWebhook } from "../../../apps/api/src/plugin-host/routes/dispatch-plugin-webhook";
import {
  createTempDir,
  descriptor,
  removeTempDirs,
  writeFiles,
  writePluginPackage,
} from "./fixtures";

const options = {
  configPath: "/kaneo/kaneo.config.ts",
  kaneoVersion: "2.29.3",
};

async function loadError(promise: Promise<unknown>): Promise<PluginLoadError> {
  const error = await promise.then(
    () => null,
    (reason: unknown) => reason,
  );
  expect(error).toBeInstanceOf(PluginLoadError);
  return error as PluginLoadError;
}

function dispatchApp() {
  const app = new Hono();
  app.all("/api/plugins/:pluginId/webhooks/*", dispatchPluginWebhook);
  app.use("*", async (c, next) => {
    c.set("userId" as never, "user-1" as never);
    c.set("userEmail" as never, "user@example.com" as never);
    c.set("user" as never, null as never);
    c.set("session" as never, null as never);
    await next();
  });
  app.all("/api/plugins/:pluginId/*", dispatchPluginRoute);
  return app;
}

afterEach(async () => {
  stopPluginJobs();
  clearLoadedPlugins();
  await removeTempDirs();
  vi.restoreAllMocks();
});

describe("loadPlugins", () => {
  it("loads a plugin and routes requests through its app", async () => {
    const { root, url } = await writePluginPackage();
    const schema = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: (value: unknown) => ({
          value: { autoComplete: true, ...(value as object) },
        }),
      },
    };

    const [loaded] = await loadPlugins(
      [descriptor(url, { extra: 1 }, schema)],
      options,
    );

    expect(loaded).toMatchObject({
      id: "kaneo-plugin-progress",
      name: "kaneo-plugin-progress",
      packageName: "kaneo-plugin-progress",
      version: "1.2.0",
      options: { autoComplete: true, extra: 1 },
      settings: { doneStatus: { type: "text" } },
      web: {
        root: join(root, "dist/web"),
        entry: "index.js",
        styles: "index.css",
        excluded: [join(root, "dist/server.js")],
      },
    });
    expect(getLoadedPlugin("kaneo-plugin-progress")).toBe(loaded);
    expect(loaded?.server?.handlers.get("task.created")).toHaveLength(1);

    const app = dispatchApp();
    const response = await app.request(
      "/api/plugins/kaneo-plugin-progress/tasks/task-1/progress",
      { method: "PUT" },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      taskId: "task-1",
      userId: "user-1",
      options: { autoComplete: true, extra: 1 },
      plugin: { id: "kaneo-plugin-progress", version: "1.2.0" },
    });
  });

  it("isolates plugin errors and answers unknown paths with JSON 404", async () => {
    const { url } = await writePluginPackage();
    await loadPlugins([descriptor(url)], options);
    const app = dispatchApp();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});

    const boom = await app.request("/api/plugins/kaneo-plugin-progress/boom");
    expect(boom.status).toBe(500);
    expect(await boom.json()).toEqual({ message: "Internal Server Error" });
    expect(log).toHaveBeenCalledWith(
      "[plugin:kaneo-plugin-progress]",
      expect.any(Error),
    );

    const teapot = await app.request(
      "/api/plugins/kaneo-plugin-progress/teapot",
    );
    expect(teapot.status).toBe(418);
    expect(await teapot.text()).toBe("short and stout");

    const missing = await app.request(
      "/api/plugins/kaneo-plugin-progress/missing",
    );
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ message: "Not found" });
  });

  it("keeps reserved segments and unknown plugins away from plugin routes", async () => {
    const { url } = await writePluginPackage();
    await loadPlugins([descriptor(url)], options);
    const app = dispatchApp();

    const reserved = await app.request(
      "/api/plugins/kaneo-plugin-progress/assets/sneaky",
    );
    expect(reserved.status).toBe(404);

    const unknown = await app.request("/api/plugins/nope/tasks/1/progress", {
      method: "PUT",
    });
    expect(unknown.status).toBe(404);
  });

  it("dispatches webhooks without authentication variables", async () => {
    const { url } = await writePluginPackage();
    await loadPlugins([descriptor(url)], options);
    const app = dispatchApp();

    const response = await app.request(
      "/api/plugins/kaneo-plugin-progress/webhooks/incoming",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ping: true }),
      },
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      received: { ping: true },
      userId: null,
    });
  });

  it("rejects plugin route requests that carry no authenticated user", async () => {
    const { url } = await writePluginPackage();
    const [loaded] = await loadPlugins([descriptor(url)], options);

    const response = await loaded!.server!.routes.request(
      "/api/plugins/kaneo-plugin-progress/tasks/1/progress",
      { method: "PUT" },
    );
    expect(response.status).toBe(401);
  });

  it("loads web-only plugins without importing a server entry", async () => {
    const { url } = await writePluginPackage({
      exports: { ".": "./dist/index.js", "./web": "./dist/web/index.js" },
      kaneo: { id: "progress", name: "Task progress" },
      files: { "dist/web/index.css": "" },
    });

    const [loaded] = await loadPlugins([descriptor(url)], options);
    expect(loaded).toMatchObject({
      id: "progress",
      name: "Task progress",
      server: null,
      settings: {},
      web: { entry: "index.js", excluded: [] },
    });
  });

  it("warns instead of failing when engines.kaneo is missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { url } = await writePluginPackage({ engines: null });

    await loadPlugins([descriptor(url)], options);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("does not declare engines.kaneo"),
    );
  });

  it("fails at resolve when the factory URL is not a file", async () => {
    const error = await loadError(
      loadPlugins([descriptor("https://example.com/plugin.js")], options),
    );
    expect(error.stage).toBe("resolve");
    expect(error.plugin).toBe("https://example.com/plugin.js");
  });

  it("fails at resolve when package.json is not a plugin package", async () => {
    const { url } = await writePluginPackage({
      exports: { ".": "./dist/index.js" },
    });
    const error = await loadError(loadPlugins([descriptor(url)], options));
    expect(error.stage).toBe("resolve");
    expect(error.plugin).toBe("kaneo-plugin-progress");
    expect(error.message).toContain('Export at least one of "./server"');
  });

  it("fails at entry when an export points to a missing file", async () => {
    const { url } = await writePluginPackage({
      exports: { ".": "./dist/index.js", "./server": "./dist/missing.js" },
    });
    const error = await loadError(loadPlugins([descriptor(url)], options));
    expect(error.stage).toBe("entry");
    expect(error.message).toContain("./dist/missing.js");
  });

  it("fails at entry when an export escapes the package through a symlink", async () => {
    const outside = await createTempDir();
    await writeFiles(outside, { "server.js": "export default {};\n" });
    const { root, url } = await writePluginPackage({
      exports: { ".": "./dist/index.js", "./server": "./dist/linked.js" },
    });
    await symlink(join(outside, "server.js"), join(root, "dist/linked.js"));

    const error = await loadError(loadPlugins([descriptor(url)], options));
    expect(error.stage).toBe("entry");
    expect(error.message).toContain("outside the package");
  });

  it("fails at compatibility with an actionable message", async () => {
    const { url } = await writePluginPackage({ engines: ">=2.31 <3" });
    const error = await loadError(
      loadPlugins([descriptor(url)], { ...options, kaneoVersion: "3.0.0" }),
    );
    expect(error.format()).toBe(
      [
        'Plugin "kaneo-plugin-progress" failed at compatibility:',
        "1.2.0 supports Kaneo >=2.31 <3, this is Kaneo 3.0.0.",
        "Install a version that supports Kaneo 3.0.0, or remove it from /kaneo/kaneo.config.ts.",
      ].join("\n"),
    );
  });

  it("fails at options and lists every issue", async () => {
    const { url } = await writePluginPackage();
    const schema = {
      "~standard": {
        version: 1 as const,
        vendor: "test",
        validate: async () => ({
          issues: [
            { message: "Expected boolean", path: ["autoComplete"] },
            { message: "Required", path: [{ key: "nested" }, 0] },
            { message: "Expected object" },
          ],
        }),
      },
    };
    const error = await loadError(
      loadPlugins([descriptor(url, "nope", schema)], options),
    );
    expect(error.stage).toBe("options");
    expect(error.message).toBe(
      [
        "The options are invalid:",
        "autoComplete: Expected boolean",
        "nested.0: Required",
        "options: Expected object",
      ].join("\n"),
    );
  });

  it("fails at import when the server entry has no server plugin", async () => {
    const { url } = await writePluginPackage({
      files: { "dist/server.js": "export default { kind: 'nope' };\n" },
    });
    const error = await loadError(loadPlugins([descriptor(url)], options));
    expect(error.stage).toBe("import");
    expect(error.message).toContain("defineServer()");
  });

  it("fails at import when the server entry throws while loading", async () => {
    const { url } = await writePluginPackage({
      files: { "dist/server.js": "throw new Error('cannot load');\n" },
    });
    const error = await loadError(loadPlugins([descriptor(url)], options));
    expect(error.stage).toBe("import");
    expect(error.message).toContain("cannot load");
  });

  it("fails at start when setup throws", async () => {
    const { url } = await writePluginPackage({
      files: {
        "dist/server.js":
          "export default { kind: 'kaneo-server', apiVersion: 1, settings: {}, setup() { throw new Error('setup broke'); } };\n",
      },
    });
    const error = await loadError(loadPlugins([descriptor(url)], options));
    expect(error.stage).toBe("start");
    expect(error.message).toBe("setup broke");
  });

  it("fails at start when setup subscribes to an unknown event", async () => {
    const { url } = await writePluginPackage({
      files: {
        "dist/server.js":
          "export default { kind: 'kaneo-server', apiVersion: 1, settings: {}, setup(kaneo) { kaneo.on('task.exploded', () => {}); } };\n",
      },
    });
    const error = await loadError(loadPlugins([descriptor(url)], options));
    expect(error.stage).toBe("start");
    expect(error.message).toContain('Unknown event "task.exploded"');
  });

  it("fails at start when two plugins share an id", async () => {
    const first = await writePluginPackage();
    const second = await writePluginPackage({
      name: "@acme/progress",
      kaneo: { id: "kaneo-plugin-progress" },
    });
    const error = await loadError(
      loadPlugins([descriptor(first.url), descriptor(second.url)], options),
    );
    expect(error.stage).toBe("start");
    expect(error.plugin).toBe("@acme/progress");
    expect(error.message).toContain('already used by "kaneo-plugin-progress"');
  });
});
