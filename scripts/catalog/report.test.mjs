import assert from "node:assert/strict";
import { test } from "node:test";
import {
  checkReport,
  packageResult,
  pluginCount,
  renderPackageResult,
  renderProblems,
  renderValid,
} from "./report.mjs";

const entry = { package: "kaneo-plugin-example", kaneo: ">=2.29.0 <3" };

const manifest = {
  name: "kaneo-plugin-example",
  version: "1.0.0",
  keywords: ["kaneo-plugin"],
  engines: { kaneo: ">=2.29.0 <3" },
  exports: { "./server": "./dist/server.js" },
  dist: { attestations: { provenance: {} } },
};

test("renders the offline messages", () => {
  assert.equal(renderValid(1), "catalog/index.json is valid (1 plugin listed)");
  assert.equal(
    renderValid(2),
    "catalog/index.json is valid (2 plugins listed)",
  );
  assert.deepEqual(renderProblems(['missing "kaneo"']), [
    "catalog/index.json has problems:",
    '  - missing "kaneo"',
    "",
    "See catalog/README.md for the entry format.",
  ]);
  assert.equal(pluginCount({ plugins: [entry] }), 1);
  assert.equal(pluginCount({ plugins: "nope" }), 0);
});

test("turns npm view results into package results", () => {
  assert.deepEqual(packageResult(entry, { notFound: true }), {
    package: "kaneo-plugin-example",
    version: null,
    errors: ["not found on npm"],
    warnings: [],
  });
  assert.deepEqual(packageResult(entry, { error: "ETIMEDOUT" }).errors, [
    "npm view failed: ETIMEDOUT",
  ]);
  assert.deepEqual(packageResult(entry, { manifest }), {
    package: "kaneo-plugin-example",
    version: "1.0.0",
    errors: [],
    warnings: [],
  });
});

test("renders package results like the sequential check did", () => {
  assert.deepEqual(renderPackageResult(packageResult(entry, { manifest })), [
    "kaneo-plugin-example@1.0.0: OK",
  ]);
  assert.deepEqual(
    renderPackageResult(packageResult(entry, { notFound: true })),
    ["kaneo-plugin-example:", "  error: not found on npm"],
  );
  assert.deepEqual(
    renderPackageResult({
      package: "vite",
      version: "7.1.0",
      errors: ['"keywords" does not include "kaneo-plugin"'],
      warnings: ["was published without npm provenance"],
    }),
    [
      "vite@7.1.0:",
      '  error: "keywords" does not include "kaneo-plugin"',
      "  warning: was published without npm provenance",
    ],
  );
});

test("summarizes the check as one JSON report", () => {
  assert.deepEqual(checkReport({ plugins: 0, problems: [] }), {
    ok: true,
    plugins: 0,
    problems: [],
  });
  assert.deepEqual(checkReport({ plugins: 1, problems: ["bad"] }).ok, false);
  const failing = packageResult(entry, { notFound: true });
  assert.deepEqual(
    checkReport({ plugins: 1, problems: [], packages: [failing] }),
    { ok: false, plugins: 1, problems: [], packages: [failing] },
  );
});
