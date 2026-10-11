import { symlink } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { assetContentType } from "../../../apps/api/src/plugin-host/assets/content-type";
import { etagMatches } from "../../../apps/api/src/plugin-host/assets/etag";
import { parseAssetPath } from "../../../apps/api/src/plugin-host/assets/parse-asset-path";
import { servePluginAsset } from "../../../apps/api/src/plugin-host/assets/serve-plugin-asset";
import {
  clearLoadedPlugins,
  registerLoadedPlugin,
} from "../../../apps/api/src/plugin-host/registry";
import { createTempDir, removeTempDirs, writeFiles } from "./fixtures";

describe("parseAssetPath", () => {
  it("decodes the segments after /assets/", () => {
    expect(
      parseAssetPath("/api/plugins/progress/assets/chunks/a%20b.js"),
    ).toEqual(["chunks", "a b.js"]);
  });

  it("rejects traversal, dotfiles, encoded separators and empty paths", () => {
    for (const path of [
      "/api/plugins/progress/assets/../server.js",
      "/api/plugins/progress/assets/%2e%2e/server.js",
      "/api/plugins/progress/assets/a/%2E%2E/%2E%2E/package.json",
      "/api/plugins/progress/assets/a%2F..%2F..%2Fserver.js",
      "/api/plugins/progress/assets/a%5C..%5Cserver.js",
      "/api/plugins/progress/assets/.env",
      "/api/plugins/progress/assets/a//b.js",
      "/api/plugins/progress/assets/a%00.js",
      "/api/plugins/progress/assets/%E0%A4%A",
      "/api/plugins/progress/assets/",
      "/api/plugins/progress/assets",
      "/api/plugins/progress/other/index.js",
    ]) {
      expect(parseAssetPath(path)).toBeNull();
    }
  });
});

describe("asset helpers", () => {
  it("serves only known content types", () => {
    expect(assetContentType("index.js")).toBe("text/javascript; charset=utf-8");
    expect(assetContentType("index.MJS")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(assetContentType("font.woff2")).toBe("font/woff2");
    expect(assetContentType("index.ts")).toBeNull();
    expect(assetContentType("index.html")).toBeNull();
    expect(assetContentType("README")).toBeNull();
  });

  it("matches weak and strong etags in If-None-Match", () => {
    expect(etagMatches('W/"1-a-b"', 'W/"1-a-b"')).toBe(true);
    expect(etagMatches('"x", "1-a-b"', 'W/"1-a-b"')).toBe(true);
    expect(etagMatches("*", 'W/"1-a-b"')).toBe(true);
    expect(etagMatches('W/"1-a-c"', 'W/"1-a-b"')).toBe(false);
    expect(etagMatches(undefined, 'W/"1-a-b"')).toBe(false);
  });
});

describe("servePluginAsset", () => {
  let root: string;
  const app = new Hono().get(
    "/api/plugins/:pluginId/assets/*",
    servePluginAsset,
  );

  beforeEach(async () => {
    const dir = await createTempDir();
    root = join(dir, "dist");
    await writeFiles(dir, {
      "package.json": "{}",
      "dist/server.js": "export const secret = 1;",
      "dist/web/index.js": "export default {};",
      "dist/web/index.css": ".a{}",
      "dist/web/chunks/a.js": "export const a = 1;",
      "dist/web/notes.txt": "text",
      "outside.js": "export const outside = 1;",
    });
    await symlink(join(dir, "outside.js"), join(root, "web/escape.js"));
    await symlink(join(root, "server.js"), join(root, "web/server-link.js"));
    registerLoadedPlugin({
      id: "progress",
      name: "Task progress",
      packageName: "kaneo-plugin-progress",
      version: "1.2.0",
      description: null,
      official: false,
      settings: {},
      options: undefined,
      server: null,
      web: {
        root: join(root, "web"),
        entry: "index.js",
        styles: "index.css",
        excluded: [join(root, "server.js")],
      },
    });
  });

  afterEach(async () => {
    clearLoadedPlugins();
    await removeTempDirs();
  });

  it("serves files from the web root with cache validation headers", async () => {
    const response = await app.request(
      "/api/plugins/progress/assets/chunks/a.js?v=1.2.0",
    );
    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe(
      "text/javascript; charset=utf-8",
    );
    expect(response.headers.get("Cache-Control")).toBe("no-cache");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    const etag = response.headers.get("ETag");
    expect(etag).toMatch(/^W\/"1\.2\.0-/);
    expect(await response.text()).toBe("export const a = 1;");

    const cached = await app.request(
      "/api/plugins/progress/assets/chunks/a.js",
      {
        headers: { "If-None-Match": etag ?? "" },
      },
    );
    expect(cached.status).toBe(304);
    expect(await cached.text()).toBe("");
  });

  it("returns 404 for anything outside the web root or not servable", async () => {
    for (const path of [
      "/api/plugins/progress/assets/missing.js",
      "/api/plugins/progress/assets/chunks",
      "/api/plugins/progress/assets/notes.txt",
      "/api/plugins/progress/assets/escape.js",
      "/api/plugins/progress/assets/server-link.js",
      "/api/plugins/progress/assets/%2e%2e/server.js",
      "/api/plugins/unknown/assets/index.js",
    ]) {
      const response = await app.request(path);
      expect(response.status, path).toBe(404);
    }
  });
});
