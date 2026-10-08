import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { CliError } from "../../../apps/api/src/cli/cli-error";
import type { CatalogLookup } from "../../../apps/api/src/cli/commands/add/lookup-catalog";
import type { Npm } from "../../../apps/api/src/cli/commands/add/npm";
import { runAdd } from "../../../apps/api/src/cli/commands/add/run-add";
import type { PackageRelease } from "../../../apps/api/src/cli/commands/add/select-version";
import {
  createTempDir,
  removeTempDirs,
  writeFiles,
} from "../plugin-host/fixtures";

const PACKAGE = "kaneo-plugin-time-report";

const RELEASES: PackageRelease[] = [
  { version: "1.0.0", engines: { kaneo: ">=2.20.0 <3" } },
  { version: "1.1.0", engines: { kaneo: ">=2.29.0 <3" } },
  { version: "2.0.0", engines: { kaneo: ">=3" } },
];

function setup({
  catalog = { status: "listed" } as CatalogLookup,
  interactive = false,
  answer = "",
  installs = true,
  releases = RELEASES,
}: {
  catalog?: CatalogLookup;
  interactive?: boolean;
  answer?: string;
  installs?: boolean;
  releases?: PackageRelease[];
} = {}) {
  const out: string[] = [];
  const err: string[] = [];
  const npm = {
    releases: vi.fn(async () => ({ ok: true as const, releases })),
    install: vi.fn(async () => installs),
  } satisfies Npm;
  const ask = vi.fn(async () => answer);
  return {
    out,
    err,
    npm,
    ask,
    deps: {
      output: {
        log: (message: string) => out.push(message),
        error: (message: string) => err.push(message),
      },
      prompt: { interactive, ask },
      npm,
      lookupCatalog: async () => catalog,
    },
  };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

afterEach(async () => {
  await removeTempDirs();
});

describe("runAdd", () => {
  it("creates the project, installs the newest compatible release, and writes the config", async () => {
    const projectDir = await createTempDir();
    const { out, npm, deps } = setup();

    const code = await runAdd(
      { packageName: PACKAGE, yes: false, projectDir, kaneoVersion: "2.29.3" },
      deps,
    );

    expect(code).toBe(0);
    expect(npm.releases).toHaveBeenCalledWith(PACKAGE);
    expect(npm.install).toHaveBeenCalledWith([
      `${PACKAGE}@1.1.0`,
      "@kaneo/config@2.29.3",
    ]);
    expect(await readJson(join(projectDir, "package.json"))).toEqual({
      name: "kaneo-instance",
      private: true,
      type: "module",
    });
    expect(
      await readFile(join(projectDir, "kaneo.config.ts"), "utf8"),
    ).toContain("plugins: [timeReport()],");
    expect(out).toContain(
      `Picked ${PACKAGE}@1.1.0, which supports Kaneo >=2.29.0 <3.`,
    );
    expect(out).toContain(
      "Created kaneo.config.ts with timeReport() in plugins.",
    );
    expect(out.at(-1)).toContain("check the options");
  });

  it("updates an existing project and skips @kaneo/config when it is a dependency", async () => {
    const projectDir = await createTempDir();
    await writeFiles(projectDir, {
      "package.json": JSON.stringify({
        dependencies: { "@kaneo/config": "2.29.3" },
      }),
      "kaneo.config.js": [
        'import { defineConfig } from "@kaneo/config";',
        "export default defineConfig({ plugins: [] });",
        "",
      ].join("\n"),
    });
    const { out, npm, deps } = setup();

    await runAdd(
      { packageName: PACKAGE, yes: false, projectDir, kaneoVersion: "2.29.3" },
      deps,
    );

    expect(npm.install).toHaveBeenCalledWith([`${PACKAGE}@1.1.0`]);
    expect(await readFile(join(projectDir, "kaneo.config.js"), "utf8")).toBe(
      [
        'import { defineConfig } from "@kaneo/config";',
        `import timeReport from "${PACKAGE}";`,
        "export default defineConfig({ plugins: [timeReport()] });",
        "",
      ].join("\n"),
    );
    expect(out).toContain("Added timeReport() to plugins in kaneo.config.js.");
  });

  it("requires --yes for an unlisted package outside a terminal", async () => {
    const projectDir = await createTempDir();
    const { err, npm, deps } = setup({ catalog: { status: "unlisted" } });

    await expect(
      runAdd(
        {
          packageName: PACKAGE,
          yes: false,
          projectDir,
          kaneoVersion: "2.29.3",
        },
        deps,
      ),
    ).rejects.toThrow(`Run kaneo add ${PACKAGE} --yes to add it anyway.`);
    expect(err[0]).toContain("is not listed in the Kaneo plugin catalog");
    expect(npm.install).not.toHaveBeenCalled();
    await expect(readFile(join(projectDir, "package.json"))).rejects.toThrow();
  });

  it("asks before adding an unlisted package in a terminal", async () => {
    const projectDir = await createTempDir();
    const declined = setup({
      catalog: { status: "unlisted" },
      interactive: true,
      answer: "n",
    });

    expect(
      await runAdd(
        {
          packageName: PACKAGE,
          yes: false,
          projectDir,
          kaneoVersion: "2.29.3",
        },
        declined.deps,
      ),
    ).toBe(1);
    expect(declined.ask).toHaveBeenCalledWith(`Add ${PACKAGE} anyway? [y/N] `);
    expect(declined.npm.install).not.toHaveBeenCalled();

    const accepted = setup({
      catalog: { status: "unlisted" },
      interactive: true,
      answer: "yes",
    });
    expect(
      await runAdd(
        {
          packageName: PACKAGE,
          yes: false,
          projectDir,
          kaneoVersion: "2.29.3",
        },
        accepted.deps,
      ),
    ).toBe(0);
    expect(accepted.npm.install).toHaveBeenCalled();
  });

  it("warns and continues with --yes when the catalog cannot be checked", async () => {
    const projectDir = await createTempDir();
    const { err, npm, ask, deps } = setup({
      catalog: { status: "unavailable", reason: "fetch failed" },
    });

    expect(
      await runAdd(
        { packageName: PACKAGE, yes: true, projectDir, kaneoVersion: "2.29.3" },
        deps,
      ),
    ).toBe(0);
    expect(err[0]).toBe(
      "warn  Could not check the Kaneo plugin catalog: fetch failed. Only add packages you trust.",
    );
    expect(ask).not.toHaveBeenCalled();
    expect(npm.install).toHaveBeenCalled();
  });

  it("fails without installing when no release supports this Kaneo", async () => {
    const projectDir = await createTempDir();
    const { npm, deps } = setup();

    await expect(
      runAdd(
        { packageName: PACKAGE, yes: true, projectDir, kaneoVersion: "1.5.0" },
        deps,
      ),
    ).rejects.toThrow(
      `No release of ${PACKAGE} supports Kaneo 1.5.0. The newest, 2.0.0, supports Kaneo >=3.`,
    );
    expect(npm.install).not.toHaveBeenCalled();
  });

  it("explains a package that never declares engines.kaneo", async () => {
    const projectDir = await createTempDir();
    const { deps } = setup({ releases: [{ version: "1.0.0" }] });

    await expect(
      runAdd(
        { packageName: PACKAGE, yes: true, projectDir, kaneoVersion: "2.29.3" },
        deps,
      ),
    ).rejects.toThrow("declares engines.kaneo");
  });

  it("leaves the config alone when npm install fails", async () => {
    const projectDir = await createTempDir();
    const { deps } = setup({ installs: false });

    await expect(
      runAdd(
        { packageName: PACKAGE, yes: true, projectDir, kaneoVersion: "2.29.3" },
        deps,
      ),
    ).rejects.toThrow("npm install failed");
    await expect(
      readFile(join(projectDir, "kaneo.config.ts")),
    ).rejects.toThrow();
  });

  it("prints the lines to add when the config cannot be edited safely", async () => {
    const projectDir = await createTempDir();
    const source = [
      'import { defineConfig } from "@kaneo/config";',
      "export default defineConfig(shared);",
      "",
    ].join("\n");
    await writeFiles(projectDir, { "kaneo.config.ts": source });
    const { err, deps } = setup();

    expect(
      await runAdd(
        { packageName: PACKAGE, yes: true, projectDir, kaneoVersion: "2.29.3" },
        deps,
      ),
    ).toBe(0);
    expect(await readFile(join(projectDir, "kaneo.config.ts"), "utf8")).toBe(
      source,
    );
    expect(err.join("\n")).toContain(`  import timeReport from "${PACKAGE}";`);
    expect(err.join("\n")).toContain(
      "Then add timeReport() to the plugins array in defineConfig({ ... }), or add plugins: [timeReport()] if there is none.",
    );
  });

  it("needs to know the Kaneo version", async () => {
    const projectDir = await createTempDir();
    const { npm, deps } = setup();

    await expect(
      runAdd(
        { packageName: PACKAGE, yes: true, projectDir, kaneoVersion: null },
        deps,
      ),
    ).rejects.toThrow(CliError);
    expect(npm.releases).not.toHaveBeenCalled();
  });
});
