import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { runCheck } from "../../../apps/api/src/cli/commands/check";
import { main } from "../../../apps/api/src/cli/main";
import type { OfficialPlugin } from "../../../apps/api/src/plugin-host/official/official-plugins";
import { listLoadedPlugins } from "../../../apps/api/src/plugin-host/registry";
import {
  createTempDir,
  descriptor,
  removeTempDirs,
  writeFiles,
  writePluginPackage,
} from "../plugin-host/fixtures";

const official = vi.hoisted(() => [] as OfficialPlugin[]);

vi.mock("../../../apps/api/src/plugin-host/official/official-plugins", () => ({
  OFFICIAL_PLUGINS: official,
}));

const SETUP_MARKER = "__kaneoCheckSetupRan";

const SERVER_WITH_MARKER = `
export default {
  kind: "kaneo-server",
  apiVersion: 1,
  settings: {},
  setup() {
    globalThis.${SETUP_MARKER} = true;
  },
};
`;

function collect() {
  const out: string[] = [];
  const err: string[] = [];
  return {
    out,
    err,
    output: {
      log: (message: string) => out.push(message),
      error: (message: string) => err.push(message),
    },
  };
}

async function officialGantt() {
  const { url } = await writePluginPackage({
    name: "@kaneo/gantt",
    version: "0.1.0",
    kaneo: { id: "gantt", name: "Gantt" },
  });
  official.splice(0, official.length, {
    id: "gantt",
    packageName: "@kaneo/gantt",
    importFactory: async () => ({ default: () => descriptor(url) }),
  });
}

async function projectWithConfig(urls: string[], extra = "") {
  const dir = await createTempDir();
  const plugins = urls
    .map(
      (url) =>
        `{ kind: "kaneo-plugin", apiVersion: 1, url: ${JSON.stringify(url)}, options: undefined, schema: null }`,
    )
    .join(", ");
  await writeFiles(dir, {
    "kaneo.config.mjs": `export default { ${extra} plugins: [${plugins}] };\n`,
  });
  return { dir, configPath: join(dir, "kaneo.config.mjs") };
}

afterEach(async () => {
  await removeTempDirs();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  official.length = 0;
  delete (globalThis as Record<string, unknown>)[SETUP_MARKER];
});

describe("kaneo check", () => {
  it("passes official and configured plugins without starting them", async () => {
    await officialGantt();
    const plugin = await writePluginPackage({
      files: { "dist/server.js": SERVER_WITH_MARKER },
    });
    const project = await projectWithConfig([plugin.url]);
    const { out, err, output } = collect();

    const code = await runCheck(
      { ...project, projectDir: project.dir, kaneoVersion: "2.29.3" },
      output,
    );

    expect(code).toBe(0);
    expect(out).toEqual([
      `Checking ${project.configPath} against Kaneo 2.29.3`,
      "ok  gantt 0.1.0",
      "ok  kaneo-plugin-progress 1.2.0",
    ]);
    expect(err).toEqual([]);
    expect(
      (globalThis as Record<string, unknown>)[SETUP_MARKER],
    ).toBeUndefined();
    expect(listLoadedPlugins()).toEqual([]);
  });

  it("checks only the built-in plugins without a config and says so", async () => {
    await officialGantt();
    const dir = await createTempDir();
    const { out, output } = collect();

    expect(
      await runCheck(
        { projectDir: dir, configPath: null, kaneoVersion: "2.29.3" },
        output,
      ),
    ).toBe(0);
    expect(out).toEqual([
      `No kaneo.config.ts, kaneo.config.js, or kaneo.config.mjs in ${dir}, so only the built-in plugins are checked.`,
      "ok  gantt 0.1.0",
    ]);
  });

  it("reports every failing plugin with the boot error and exits 1", async () => {
    await officialGantt();
    const incompatible = await writePluginPackage({
      name: "kaneo-plugin-old",
      engines: ">=2.31 <3",
    });
    const broken = await writePluginPackage({
      name: "kaneo-plugin-broken",
      files: { "dist/server.js": "throw new Error('cannot load');\n" },
    });
    const fine = await writePluginPackage({ name: "kaneo-plugin-fine" });
    const project = await projectWithConfig([
      incompatible.url,
      broken.url,
      fine.url,
    ]);
    const { out, err, output } = collect();

    const code = await runCheck(
      { ...project, projectDir: project.dir, kaneoVersion: "2.29.3" },
      output,
    );

    expect(code).toBe(1);
    expect(out).toContain("ok  kaneo-plugin-fine 1.2.0");
    expect(err).toEqual([
      [
        'Plugin "kaneo-plugin-old" failed at compatibility:',
        "1.2.0 supports Kaneo >=2.31 <3, this is Kaneo 2.29.3.",
        `Install a version that supports Kaneo 2.29.3, or remove it from ${project.configPath}.`,
      ].join("\n"),
      expect.stringContaining(
        'Plugin "kaneo-plugin-broken" failed at import:\ncannot load',
      ),
      "2 of 4 plugins failed. Kaneo would stop at startup with this config.",
    ]);
  });

  it("reports an id that a built-in plugin already uses", async () => {
    await officialGantt();
    const fork = await writePluginPackage({
      name: "@acme/gantt",
      kaneo: { id: "gantt" },
    });
    const project = await projectWithConfig([fork.url]);
    const { err, output } = collect();

    expect(
      await runCheck(
        { ...project, projectDir: project.dir, kaneoVersion: "2.29.3" },
        output,
      ),
    ).toBe(1);
    expect(err[0]).toContain('Plugin "@acme/gantt" failed at start:');
    expect(err[0]).toContain("official: { gantt: false }");
  });

  it("skips built-in plugins the config turns off", async () => {
    await officialGantt();
    const project = await projectWithConfig([], "official: { gantt: false },");
    const { out, output } = collect();

    expect(
      await runCheck(
        { ...project, projectDir: project.dir, kaneoVersion: "2.29.3" },
        output,
      ),
    ).toBe(0);
    expect(out).toEqual([
      `Checking ${project.configPath} against Kaneo 2.29.3`,
      `${project.configPath} declares no plugins.`,
    ]);
  });

  it("runs from the command line and prints config errors", async () => {
    await officialGantt();
    const dir = await createTempDir();
    await writeFiles(dir, {
      "kaneo.config.mjs": "export default { plugins: [() => null] };\n",
    });
    vi.stubEnv("KANEO_CONFIG", "");
    vi.stubEnv("KANEO_PROJECT_DIR", "");
    const { err, output } = collect();

    expect(await main(["check", "--project", dir], output)).toBe(1);
    expect(err.join("\n")).toContain("Kaneo could not load its plugin config:");
    expect(err.join("\n")).toContain("plugins[0] is a function");
  });
});
