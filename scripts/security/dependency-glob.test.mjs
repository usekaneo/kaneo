import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const mobileRequire = createRequire(
  new URL("../../apps/mobile/package.json", import.meta.url),
);
const expoRequire = createRequire(mobileRequire.resolve("expo/package.json"));
const cliRequire = createRequire(expoRequire.resolve("@expo/cli/package.json"));
const globRequire = createRequire(cliRequire.resolve("glob"));

test("Expo glob retains recursive matching, dotfile and ignore behavior", async () => {
  const { glob } = cliRequire("glob");
  const directory = await mkdtemp(join(tmpdir(), "kaneo-glob-security-"));
  try {
    await mkdir(join(directory, "nested"));
    await writeFile(join(directory, "nested", "keep.json"), "{}");
    await writeFile(join(directory, "nested", "ignore.json"), "{}");
    await writeFile(join(directory, ".hidden.json"), "{}");
    const options = { cwd: directory, dot: true, ignore: "**/ignore.json" };
    assert.deepEqual((await glob("**/*.json", options)).sort(), [
      ".hidden.json",
      "nested/keep.json",
    ]);
    assert.deepEqual(cliRequire("glob").globSync("**/*.json", options).sort(), [
      ".hidden.json",
      "nested/keep.json",
    ]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("glob preprocessing cannot amplify a small pattern without a bound", () => {
  const entry = globRequire.resolve("minimatch");
  const code = `const {Minimatch}=require(${JSON.stringify(entry)});new Minimatch(Array(22).fill('**/..').join('/')+'/file',{optimizationLevel:2});process.stdout.write('completed');`;
  const child = spawnSync(process.execPath, ["-e", code], {
    timeout: 5000,
    maxBuffer: 4096,
    encoding: "utf8",
  });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.status, 0, child.stderr);
  assert.equal(child.stdout, "completed");
});
