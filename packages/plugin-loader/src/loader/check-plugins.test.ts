import { afterEach, describe, expect, it } from "vite-plus/test";
import {
  descriptor,
  removeTempDirs,
  writePluginPackage,
} from "../testing/fixtures.js";
import { checkPlugins } from "./check-plugins.js";

const SETUP_MARKER = "__kaneoCheckSetupRan";

const SERVER_WITH_MARKER = `export default { kind: "kaneo-server", apiVersion: 1, settings: {}, setup() { globalThis.${SETUP_MARKER} = true; } };\n`;

const options = {
  configPath: "/kaneo/kaneo.config.ts",
  kaneoVersion: "2.29.3",
};

afterEach(async () => {
  await removeTempDirs();
  delete (globalThis as Record<string, unknown>)[SETUP_MARKER];
});

describe("checkPlugins", () => {
  it("passes plugins through every stage without running setup", async () => {
    const gantt = await writePluginPackage({
      name: "@kaneo/gantt",
      version: "0.1.0",
      kaneo: { id: "gantt" },
    });
    const plugin = await writePluginPackage({
      files: { "dist/server.js": SERVER_WITH_MARKER },
    });
    const official = descriptor(gantt.url);

    expect(
      await checkPlugins([official, descriptor(plugin.url)], {
        ...options,
        official: new Set([official]),
      }),
    ).toEqual([
      {
        ok: true,
        id: "gantt",
        packageName: "@kaneo/gantt",
        version: "0.1.0",
        official: true,
      },
      {
        ok: true,
        id: "kaneo-plugin-progress",
        packageName: "kaneo-plugin-progress",
        version: "1.2.0",
        official: false,
      },
    ]);
    expect(
      (globalThis as Record<string, unknown>)[SETUP_MARKER],
    ).toBeUndefined();
  });

  it("reports every failing plugin with the boot error", async () => {
    const incompatible = await writePluginPackage({
      name: "kaneo-plugin-old",
      engines: ">=2.31 <3",
    });
    const broken = await writePluginPackage({
      name: "kaneo-plugin-broken",
      files: { "dist/server.js": "throw new Error('cannot load');\n" },
    });
    const fine = await writePluginPackage({ name: "kaneo-plugin-fine" });

    const results = await checkPlugins(
      [incompatible.url, broken.url, fine.url].map((url) => descriptor(url)),
      options,
    );

    expect(results.map((result) => result.ok)).toEqual([false, false, true]);
    const [old, failed] = results;
    expect(old?.ok === false && old.error.format()).toBe(
      [
        'Plugin "kaneo-plugin-old" failed at compatibility:',
        "1.2.0 supports Kaneo >=2.31 <3, this is Kaneo 2.29.3.",
        "Install a version that supports Kaneo 2.29.3, or remove it from /kaneo/kaneo.config.ts.",
      ].join("\n"),
    );
    expect(failed).toMatchObject({
      ok: false,
      official: false,
      error: { stage: "import", plugin: "kaneo-plugin-broken" },
    });
  });

  it("reports an id that a built-in plugin already uses", async () => {
    const gantt = await writePluginPackage({
      name: "@kaneo/gantt",
      kaneo: { id: "gantt" },
    });
    const fork = await writePluginPackage({
      name: "@acme/gantt",
      kaneo: { id: "gantt" },
    });
    const official = descriptor(gantt.url);

    const [, clash] = await checkPlugins([official, descriptor(fork.url)], {
      ...options,
      official: new Set([official]),
    });

    expect(clash).toMatchObject({
      ok: false,
      error: { stage: "start", plugin: "@acme/gantt" },
    });
    expect(clash?.ok === false && clash.error.hint).toContain(
      "official: { gantt: false }",
    );
  });

  it("passes warnings to the caller instead of the log", async () => {
    const plugin = await writePluginPackage({ engines: null });
    const warnings: string[] = [];

    await checkPlugins([descriptor(plugin.url)], {
      ...options,
      onWarning: (message) => warnings.push(message),
    });

    expect(warnings).toEqual([
      'Plugin "kaneo-plugin-progress" 1.2.0 does not declare engines.kaneo, so Kaneo cannot check that it supports this version.',
    ]);
  });
});
