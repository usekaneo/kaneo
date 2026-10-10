import { readFile } from "node:fs/promises";
import { join } from "node:path";
import * as NodeServices from "@effect/platform-node/NodeServices";
import { Effect, Layer, Option, Result } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import type { CatalogLookup } from "../../plugins/lookup-catalog.js";
import type { PackageRelease } from "../../plugins/select-version.js";
import type { NpmInstallResult } from "../../services/npm.js";
import {
  fakeCatalog,
  fakeNpm,
  testEnvironment,
} from "../../testing/plugin-layers.js";
import {
  createTempDir,
  removeTempDirs,
  writeFiles,
  writeInstallation,
} from "../../testing/plugin-project.js";
import { captureOutput } from "../../testing/test-layers.js";
import { runPluginAdd } from "./add.js";

const PACKAGE = "kaneo-plugin-time-report";

const RELEASES: PackageRelease[] = [
  { version: "1.0.0", engines: { kaneo: ">=2.20.0 <3" } },
  { version: "1.1.0", engines: { kaneo: ">=2.29.0 <3" } },
  { version: "2.0.0", engines: { kaneo: ">=3" } },
];

type Setup = {
  readonly projectDir: string;
  readonly yes?: boolean;
  readonly kaneoVersion?: string;
  readonly cliDir?: string | null;
  readonly catalog?: CatalogLookup;
  readonly install?: NpmInstallResult;
  readonly mode?: "json" | "human";
};

function run(setup: Setup) {
  const npm = fakeNpm(RELEASES, setup.install);
  const output = captureOutput(setup.mode ?? "json");
  const result = Effect.runPromise(
    Effect.result(
      runPluginAdd({
        packageName: PACKAGE,
        yes: setup.yes ?? false,
        project: Option.some(setup.projectDir),
        kaneoVersion: Option.fromUndefinedOr(
          "kaneoVersion" in setup ? setup.kaneoVersion : "2.29.3",
        ),
        cliDir: setup.cliDir ?? null,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(
            npm.layer,
            fakeCatalog(setup.catalog ?? { status: "listed" }),
            testEnvironment(setup.projectDir),
            output.layer,
            NodeServices.layer,
          ),
        ),
      ),
    ),
  );
  return { npm, output, result };
}

async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

afterEach(removeTempDirs);

describe("kaneo plugin add", () => {
  it("creates the project, installs the newest compatible release, and writes the config", async () => {
    const projectDir = await createTempDir();
    const { npm, output, result } = run({ projectDir });

    expect(Result.isSuccess(await result)).toBe(true);
    expect(npm.calls).toEqual([
      { kind: "releases", cwd: projectDir, name: PACKAGE },
      {
        kind: "install",
        cwd: projectDir,
        specs: [`${PACKAGE}@1.1.0`, "@kaneo/config@2.29.3"],
      },
    ]);
    expect(await readJson(join(projectDir, "package.json"))).toEqual({
      name: "kaneo-instance",
      private: true,
      type: "module",
    });
    expect(
      await readFile(join(projectDir, "kaneo.config.ts"), "utf8"),
    ).toContain("plugins: [timeReport()],");
    expect(JSON.parse(output.stdout.join(""))).toEqual({
      packageName: PACKAGE,
      version: "1.1.0",
      range: ">=2.29.0 <3",
      kaneoVersion: "2.29.3",
      kaneoVersionSource: "flag",
      catalog: "listed",
      projectDir,
      installed: [`${PACKAGE}@1.1.0`, "@kaneo/config@2.29.3"],
      createdPackageJson: true,
      config: {
        status: "created",
        file: join(projectDir, "kaneo.config.ts"),
        importName: "timeReport",
      },
    });
    expect(output.stderr).toEqual([]);
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
    const { npm, result } = run({ projectDir });

    expect(Result.isSuccess(await result)).toBe(true);
    expect(npm.calls.at(-1)).toMatchObject({ specs: [`${PACKAGE}@1.1.0`] });
    expect(await readFile(join(projectDir, "kaneo.config.js"), "utf8")).toBe(
      [
        'import { defineConfig } from "@kaneo/config";',
        `import timeReport from "${PACKAGE}";`,
        "export default defineConfig({ plugins: [timeReport()] });",
        "",
      ].join("\n"),
    );
  });

  it("requires --yes for an unlisted package outside a terminal", async () => {
    const projectDir = await createTempDir();
    const { npm, result } = run({
      projectDir,
      catalog: { status: "unlisted" },
    });

    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure).toMatchObject({
      _tag: "InvalidArgument",
      message: `Adding ${PACKAGE}, which is not in the Kaneo plugin catalog, needs confirmation. Pass --yes to confirm.`,
    });
    expect(npm.calls.map((call) => call.kind)).toEqual(["releases"]);
    await expect(readFile(join(projectDir, "package.json"))).rejects.toThrow();
  });

  it("warns and continues with --yes when the catalog cannot be checked", async () => {
    const projectDir = await createTempDir();
    const { npm, output, result } = run({
      projectDir,
      yes: true,
      mode: "human",
      catalog: { status: "unavailable", reason: "fetch failed" },
    });

    expect(Result.isSuccess(await result)).toBe(true);
    expect(output.stderr.join("")).toContain(
      "Could not check the Kaneo plugin catalog: fetch failed. Only add packages you trust.",
    );
    expect(npm.calls.map((call) => call.kind)).toEqual(["releases", "install"]);
  });

  it("fails without installing when no release supports this Kaneo", async () => {
    const projectDir = await createTempDir();
    const { npm, result } = run({ projectDir, kaneoVersion: "1.5.0" });

    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure.message).toBe(
      `No release of ${PACKAGE} supports Kaneo 1.5.0. The newest, 2.0.0, supports Kaneo >=3.`,
    );
    expect(npm.calls.map((call) => call.kind)).toEqual(["releases"]);
  });

  it("leaves the config alone when npm install fails", async () => {
    const projectDir = await createTempDir();
    const { result } = run({
      projectDir,
      install: { ok: false, message: "Unable to authenticate" },
    });

    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure.message).toBe(
      "npm install failed: Unable to authenticate",
    );
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
    const { output, result } = run({ projectDir, mode: "human" });

    expect(Result.isSuccess(await result)).toBe(true);
    expect(await readFile(join(projectDir, "kaneo.config.ts"), "utf8")).toBe(
      source,
    );
    expect(output.stdout.join("")).toContain(
      `      import timeReport from "${PACKAGE}";`,
    );
  });

  it("picks the version of the Kaneo installation the CLI runs in", async () => {
    const root = await writeInstallation("2.31.0");
    const projectDir = await createTempDir();
    const { output, result } = run({
      projectDir,
      kaneoVersion: undefined,
      cliDir: join(root, "packages/cli/dist"),
    });

    expect(Result.isSuccess(await result)).toBe(true);
    expect(JSON.parse(output.stdout.join(""))).toMatchObject({
      kaneoVersion: "2.31.0",
      kaneoVersionSource: "installation",
      installed: [`${PACKAGE}@1.1.0`, "@kaneo/config@2.31.0"],
    });
  });

  it("falls back to the project's @kaneo/config version", async () => {
    const projectDir = await createTempDir();
    await writeFiles(projectDir, {
      "package.json": JSON.stringify({
        dependencies: { "@kaneo/config": "2.30.0" },
      }),
      "node_modules/@kaneo/config/package.json": JSON.stringify({
        name: "@kaneo/config",
        version: "2.30.0",
      }),
    });
    const { output, result } = run({ projectDir, kaneoVersion: undefined });

    expect(Result.isSuccess(await result)).toBe(true);
    expect(JSON.parse(output.stdout.join(""))).toMatchObject({
      kaneoVersion: "2.30.0",
      kaneoVersionSource: "config-package",
    });
  });

  it("needs to know the Kaneo version", async () => {
    const projectDir = await createTempDir();
    const { npm, result } = run({ projectDir, kaneoVersion: undefined });

    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure.message).toContain(
      "Could not tell which Kaneo version the plugins are for.",
    );
    expect(npm.calls).toEqual([]);
  });

  it("fails when the project directory does not exist", async () => {
    const { result } = run({ projectDir: "/no/such/dir" });
    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure.message).toBe(
      "The project directory /no/such/dir does not exist.",
    );
  });
});
