import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, test } from "node:test";
import { Effect } from "effect";
import { runCheck } from "./run-check.mjs";

const folder = await mkdtemp(join(tmpdir(), "kaneo-catalog-"));
after(() => rm(folder, { recursive: true, force: true }));

const entry = {
  package: "kaneo-plugin-example",
  repository: "https://github.com/example/kaneo-plugin-example",
  description: "Adds an example view to every project.",
  maintainers: ["example"],
  kaneo: ">=2.29.0 <3",
  addedAt: "2026-10-08",
};

const published = {
  name: "kaneo-plugin-example",
  version: "1.0.0",
  keywords: ["kaneo-plugin"],
  engines: { kaneo: ">=2.29.0 <3" },
  exports: { "./server": "./dist/server.js" },
  dist: { attestations: { provenance: {} } },
};

async function indexFile(name, catalog) {
  const path = join(folder, name);
  await writeFile(
    path,
    typeof catalog === "string" ? catalog : JSON.stringify(catalog),
  );
  return path;
}

async function check(argv, indexPath, views = {}) {
  const stdout = [];
  const stderr = [];
  const code = await Effect.runPromise(
    runCheck(argv, {
      indexPath,
      npmView: (name) => Effect.succeed(views[name] ?? { notFound: true }),
      sinks: {
        out: (text) => stdout.push(text),
        err: (text) => stderr.push(text),
      },
    }),
  );
  return { code, stdout: stdout.join(""), stderr: stderr.join("") };
}

test("accepts a valid catalog", async () => {
  const index = await indexFile("valid.json", { plugins: [entry] });
  assert.deepEqual(await check([], index), {
    code: 0,
    stdout: "catalog/index.json is valid (1 plugin listed)\n",
    stderr: "",
  });
});

test("lists problems on stderr and exits with 1", async () => {
  const index = await indexFile("invalid.json", {
    plugins: [{ ...entry, kaneo: undefined, extra: true }],
  });
  const result = await check([], index);
  assert.equal(result.code, 1);
  assert.equal(result.stdout, "");
  assert.equal(
    result.stderr,
    [
      "catalog/index.json has problems:",
      '  - plugins[0] (kaneo-plugin-example): unknown field "extra"',
      '  - plugins[0] (kaneo-plugin-example): missing "kaneo"',
      "",
      "See catalog/README.md for the entry format.",
      "",
    ].join("\n"),
  );
  const json = await check(["--json"], index);
  assert.equal(json.code, 1);
  assert.equal(JSON.parse(json.stdout).ok, false);
});

test("reports an unreadable index", async () => {
  const index = await indexFile("broken.json", "{");
  const result = await check([], index);
  assert.equal(result.code, 1);
  assert.match(result.stderr, /^catalog\/index\.json could not be read: /);
  const json = await check(["--json"], index);
  assert.equal(json.code, 1);
  assert.deepEqual(Object.keys(JSON.parse(json.stdout)), ["error"]);
});

test("checks every listed package on npm", async () => {
  const second = { ...entry, package: "kaneo-plugin-missing" };
  const index = await indexFile("remote.json", { plugins: [entry, second] });
  const result = await check(["--remote"], index, {
    "kaneo-plugin-example": { manifest: published },
  });
  assert.equal(result.code, 1);
  assert.equal(
    result.stdout,
    [
      "catalog/index.json is valid (2 plugins listed)",
      "kaneo-plugin-example@1.0.0: OK",
      "kaneo-plugin-missing:",
      "  error: not found on npm",
      "",
    ].join("\n"),
  );
  assert.equal(
    result.stderr,
    "\nA listed package does not meet the requirements in catalog/README.md.\n",
  );

  const json = await check(["--remote", "--json"], index, {
    "kaneo-plugin-example": { manifest: published },
  });
  assert.equal(json.code, 1);
  const report = JSON.parse(json.stdout);
  assert.equal(report.ok, false);
  assert.deepEqual(
    report.packages.map((result) => result.package),
    ["kaneo-plugin-example", "kaneo-plugin-missing"],
  );
});

test("rejects unknown flags", async () => {
  const index = await indexFile("flags.json", { plugins: [] });
  assert.deepEqual(await check(["--bogus", "--json"], index), {
    code: 1,
    stdout: '{"error":"Unrecognized flag: --bogus in command check.mjs"}\n',
    stderr: "",
  });
});
