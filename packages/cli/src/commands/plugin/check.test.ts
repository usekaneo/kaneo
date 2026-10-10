import { join } from "node:path";
import { Effect, Layer, Option, Result } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { testEnvironment } from "../../testing/plugin-layers.js";
import {
  configSource,
  createTempDir,
  removeTempDirs,
  writeFiles,
  writeInstallation,
  writePluginPackage,
} from "../../testing/plugin-project.js";
import { captureOutput } from "../../testing/test-layers.js";
import { runPluginCheck } from "./check.js";

const SETUP_MARKER = "__kaneoCliCheckSetupRan";

function run(options: {
  readonly projectDir: string;
  readonly config?: string;
  readonly kaneoVersion?: string;
  readonly cliDir?: string | null;
  readonly mode?: "json" | "human";
}) {
  const output = captureOutput(options.mode ?? "json");
  const result = Effect.runPromise(
    Effect.result(
      runPluginCheck({
        project: Option.some(options.projectDir),
        config: Option.fromUndefinedOr(options.config),
        kaneoVersion: Option.fromUndefinedOr(
          "kaneoVersion" in options ? options.kaneoVersion : "2.29.3",
        ),
        cliDir: options.cliDir ?? null,
      }).pipe(
        Effect.provide(
          Layer.mergeAll(testEnvironment(options.projectDir), output.layer),
        ),
      ),
    ),
  );
  return { output, result };
}

afterEach(async () => {
  await removeTempDirs();
  process.exitCode = 0;
  delete (globalThis as Record<string, unknown>)[SETUP_MARKER];
});

describe("kaneo plugin check", () => {
  it("checks the configured plugins without running their setup", async () => {
    const projectDir = await createTempDir();
    const url = await writePluginPackage(projectDir, {
      name: "kaneo-plugin-task-progress",
      version: "0.1.0",
      server: `export default { kind: "kaneo-server", apiVersion: 1, settings: {}, setup() { globalThis.${SETUP_MARKER} = true; } };\n`,
    });
    await writeFiles(projectDir, { "kaneo.config.mjs": configSource([url]) });
    const { output, result } = run({ projectDir });

    expect(Result.isSuccess(await result)).toBe(true);
    expect(JSON.parse(output.stdout.join(""))).toEqual({
      projectDir,
      configPath: join(projectDir, "kaneo.config.mjs"),
      declared: 1,
      kaneoVersion: "2.29.3",
      kaneoVersionSource: "flag",
      skippedBuiltIn: ["gantt"],
      warnings: [],
      plugins: [
        {
          status: "ok",
          id: "kaneo-plugin-task-progress",
          packageName: "kaneo-plugin-task-progress",
          version: "0.1.0",
          official: false,
        },
      ],
      failed: 0,
    });
    expect(process.exitCode ?? 0).toBe(0);
    expect(
      (globalThis as Record<string, unknown>)[SETUP_MARKER],
    ).toBeUndefined();
  });

  it("checks the built-in plugins of the Kaneo installation it runs in", async () => {
    const root = await writeInstallation("2.37.0");
    await writePluginPackage(join(root, "apps/api"), {
      name: "@kaneo/gantt",
      version: "0.9.0",
      id: "gantt",
    });
    const projectDir = await createTempDir();
    const { output, result } = run({
      projectDir,
      kaneoVersion: undefined,
      cliDir: join(root, "packages/cli/dist"),
    });

    expect(Result.isSuccess(await result)).toBe(true);
    expect(JSON.parse(output.stdout.join(""))).toMatchObject({
      configPath: null,
      kaneoVersion: "2.37.0",
      kaneoVersionSource: "installation",
      skippedBuiltIn: [],
      plugins: [
        { status: "ok", id: "gantt", version: "0.9.0", official: true },
      ],
    });
  });

  it("reports failing plugins with their stage and exits with 1", async () => {
    const projectDir = await createTempDir();
    const old = await writePluginPackage(projectDir, {
      name: "kaneo-plugin-old",
      engines: ">=2.31 <3",
    });
    const fine = await writePluginPackage(projectDir, {
      name: "kaneo-plugin-fine",
    });
    await writeFiles(projectDir, {
      "kaneo.config.mjs": configSource([old, fine]),
    });
    const { output, result } = run({ projectDir, mode: "human" });

    expect(Result.isSuccess(await result)).toBe(true);
    expect(process.exitCode).toBe(1);
    const text = output.stdout.join("");
    expect(text).toContain(
      [
        '  ✗ Plugin "kaneo-plugin-old" failed at compatibility:',
        "    1.0.0 supports Kaneo >=2.31 <3, this is Kaneo 2.29.3.",
      ].join("\n"),
    );
    expect(text).toContain("  ✓ kaneo-plugin-fine 1.0.0");
    expect(text).toContain(
      "1 of 2 plugins failed. Kaneo would stop at startup with this config.",
    );
  });

  it("lists the stage and message of each failure in JSON", async () => {
    const projectDir = await createTempDir();
    const broken = await writePluginPackage(projectDir, {
      name: "kaneo-plugin-broken",
      server: "throw new Error('cannot load');\n",
    });
    await writeFiles(projectDir, {
      "kaneo.config.mjs": configSource([broken]),
    });
    const { output, result } = run({ projectDir });

    await result;
    expect(JSON.parse(output.stdout.join("")).plugins).toEqual([
      expect.objectContaining({
        status: "failed",
        packageName: "kaneo-plugin-broken",
        stage: "import",
        message: "cannot load",
      }),
    ]);
  });

  it("fails with the boot error when the config cannot be loaded", async () => {
    const projectDir = await createTempDir();
    await writeFiles(projectDir, {
      "kaneo.config.mjs": "export default { plugins: [() => null] };\n",
    });
    const { result } = run({ projectDir });

    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure).toMatchObject({
      _tag: "InvalidArgument",
      message: expect.stringContaining(
        "Kaneo could not load its plugin config: plugins[0] is a function",
      ),
    });
  });

  it("fails when --config points to a missing file", async () => {
    const projectDir = await createTempDir();
    const { result } = run({ projectDir, config: "missing.ts" });

    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure.message).toBe(
      `--config points to ${join(projectDir, "missing.ts")}, which does not exist.`,
    );
  });

  it("needs to know the Kaneo version", async () => {
    const projectDir = await createTempDir();
    const { result } = run({ projectDir, kaneoVersion: undefined });

    const outcome = await result;
    expect(Result.isFailure(outcome) && outcome.failure.message).toContain(
      "Pass --kaneo-version",
    );
  });
});
