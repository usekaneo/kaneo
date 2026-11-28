import { describe, expect, it } from "vite-plus/test";
import { parsePluginPackage } from "./parse-plugin-package.js";
import { derivePluginId } from "./plugin-id.js";

describe("derivePluginId", () => {
  it("turns scoped package names into url-safe ids", () => {
    expect(derivePluginId("@acme/kaneo-reports")).toBe("acme-kaneo-reports");
    expect(derivePluginId("kaneo-plugin-progress")).toBe(
      "kaneo-plugin-progress",
    );
    expect(derivePluginId("@Org/My.Plugin")).toBe("org-my-plugin");
  });
});

describe("parsePluginPackage", () => {
  const base = {
    name: "kaneo-plugin-progress",
    version: "1.2.0",
    description: "Track progress",
    engines: { kaneo: ">=2.30 <3" },
    exports: {
      ".": "./dist/index.js",
      "./server": { import: "./dist/server.js", types: "./dist/server.d.ts" },
      "./web": "./dist/web/index.js",
    },
    kaneo: { name: "Task progress" },
  };

  it("reads entries, engines and display name", () => {
    expect(parsePluginPackage(base)).toEqual({
      ok: true,
      plugin: {
        id: "kaneo-plugin-progress",
        name: "Task progress",
        packageName: "kaneo-plugin-progress",
        version: "1.2.0",
        description: "Track progress",
        engines: ">=2.30 <3",
        server: "./dist/server.js",
        web: "./dist/web/index.js",
      },
    });
  });

  it("honours an id override", () => {
    const result = parsePluginPackage({ ...base, kaneo: { id: "progress" } });
    expect(result.ok && result.plugin.id).toBe("progress");
  });

  it("rejects packages without plugin entries", () => {
    const result = parsePluginPackage({
      ...base,
      exports: { ".": "./dist/index.js" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects entries that escape the package", () => {
    const result = parsePluginPackage({
      ...base,
      exports: { "./server": "../outside.js" },
    });
    expect(result.ok).toBe(false);
  });

  it("rejects invalid id overrides", () => {
    const result = parsePluginPackage({ ...base, kaneo: { id: "Bad Id" } });
    expect(result.ok).toBe(false);
  });
});
