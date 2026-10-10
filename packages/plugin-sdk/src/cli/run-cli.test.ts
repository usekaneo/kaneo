import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect } from "effect";
import { afterEach, describe, expect, it } from "vite-plus/test";
import packageJson from "../../package.json" with { type: "json" };
import { runCli } from "./run-cli.js";

const folders: string[] = [];

async function tempFolder() {
  const folder = await mkdtemp(join(tmpdir(), "kaneo-plugin-cli-"));
  folders.push(folder);
  return folder;
}

afterEach(async () => {
  await Promise.all(
    folders
      .splice(0)
      .map((folder) => rm(folder, { recursive: true, force: true })),
  );
});

async function run(argv: string[], cwd: string, isTTY = false) {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const code = await Effect.runPromise(
    runCli(
      argv,
      { env: {}, cwd, stdout: { isTTY }, stderr: { isTTY } },
      {
        out: (text) => void stdout.push(text),
        err: (text) => void stderr.push(text),
      },
    ),
  );
  return { code, stdout: stdout.join(""), stderr: stderr.join("") };
}

describe("kaneo-plugin", () => {
  it("prints help for the build command", async () => {
    const result = await run(["build", "--help"], await tempFolder());
    expect(result.code).toBe(0);
    expect(result.stdout).toContain("kaneo-plugin build [flags]");
    expect(result.stdout).toContain("--watch, -w");
  });

  it("prints the version as JSON when stdout is not a terminal", async () => {
    const result = await run(["--version"], await tempFolder());
    expect(result).toEqual({
      code: 0,
      stdout: `${JSON.stringify({ name: "kaneo-plugin", version: packageJson.version })}\n`,
      stderr: "",
    });
  });

  it("reports a missing package.json as the JSON error contract", async () => {
    const folder = await tempFolder();
    const result = await run(["build"], folder);
    expect(result).toEqual({
      code: 1,
      stdout: `${JSON.stringify({
        error: `No package.json in ${folder}. Run kaneo-plugin build from the plugin's root folder.`,
      })}\n`,
      stderr: "",
    });
  });

  it("styles errors on stderr on a terminal", async () => {
    const folder = await tempFolder();
    const result = await run(["build"], folder, true);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toBe(
      `\u001b[31merror: No package.json in ${folder}. Run kaneo-plugin build from the plugin's root folder.\u001b[39m\n`,
    );
  });

  it("points to the help for unknown flags", async () => {
    const result = await run(
      ["build", "--bogus", "--human"],
      await tempFolder(),
    );
    expect(result.code).toBe(1);
    expect(result.stderr).toBe(
      "error: Unrecognized flag: --bogus in command kaneo-plugin build\nRun kaneo-plugin build --help to see the options.\n",
    );
  });

  it("describes the built plugin as one JSON object", async () => {
    const folder = await tempFolder();
    await mkdir(join(folder, "src"));
    await writeFile(
      join(folder, "package.json"),
      JSON.stringify({
        name: "kaneo-plugin-fixture",
        version: "1.2.3",
        type: "module",
        engines: { kaneo: ">=2.29.0 <3" },
        exports: { ".": "./dist/index.js", "./server": "./dist/server.js" },
      }),
    );
    await writeFile(
      join(folder, "src/index.ts"),
      "export default function plugin() {\n  return { id: 'fixture' };\n}\n",
    );
    await writeFile(
      join(folder, "src/server.ts"),
      "export default { routes: [] };\n",
    );

    const result = await run(["build", "--json"], folder, true);
    expect(result.stderr).toBe("");
    expect(result.code).toBe(0);
    const built = JSON.parse(result.stdout);
    expect(built.plugin).toEqual({
      id: "kaneo-plugin-fixture",
      name: "kaneo-plugin-fixture",
      packageName: "kaneo-plugin-fixture",
      version: "1.2.3",
      engines: ">=2.29.0 <3",
    });
    expect(built.files.map((file: { path: string }) => file.path)).toEqual([
      "dist/index.js",
      "dist/server.js",
    ]);
    expect(built.warnings).toEqual([
      expect.stringContaining("typescript is not installed"),
    ]);
  }, 60_000);
});
