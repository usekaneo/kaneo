import assert from "node:assert/strict";
import { test } from "node:test";
import { checkPublishedPackage, readNpmView } from "./npm-checks.mjs";

const entry = { package: "kaneo-plugin-example", kaneo: ">=2.29.0 <3" };

const manifest = {
  name: "kaneo-plugin-example",
  version: "1.0.0",
  keywords: ["kaneo", "kaneo-plugin"],
  engines: { kaneo: ">=2.29.0 <3" },
  exports: { ".": "./dist/index.js", "./server": "./dist/server.js" },
  scripts: { build: "kaneo-plugin build", prepublishOnly: "npm run build" },
  dist: {
    attestations: {
      url: "https://registry.npmjs.org/-/npm/v1/attestations/kaneo-plugin-example@1.0.0",
      provenance: { predicateType: "https://slsa.dev/provenance/v1" },
    },
  },
};

test("a well-formed plugin with provenance passes cleanly", () => {
  assert.deepEqual(checkPublishedPackage(entry, manifest), {
    errors: [],
    warnings: [],
  });
  assert.deepEqual(
    checkPublishedPackage(entry, {
      ...manifest,
      exports: { "./web": "./dist/web/index.js" },
    }).errors,
    [],
  );
});

test("reports each missing plugin requirement as an error", () => {
  const { errors } = checkPublishedPackage(entry, {
    name: "kaneo-plugin-example",
    version: "1.0.0",
    keywords: ["kaneo"],
    exports: { ".": "./dist/index.js" },
    scripts: { postinstall: "node setup.js", preinstall: "node check.js" },
  });
  assert.deepEqual(errors, [
    '"keywords" does not include "kaneo-plugin"',
    '"engines.kaneo" is not declared',
    '"exports" has neither "./server" nor "./web"',
    "has install scripts: preinstall, postinstall",
  ]);
});

test("rejects an invalid engines range", () => {
  const { errors } = checkPublishedPackage(entry, {
    ...manifest,
    engines: { kaneo: "latest" },
  });
  assert.deepEqual(errors, [
    '"engines.kaneo" is "latest", which is not a semver range',
  ]);
});

test("warns without failing on missing provenance or a different range", () => {
  const result = checkPublishedPackage(entry, {
    ...manifest,
    engines: { kaneo: ">=2.30.0 <3" },
    dist: { integrity: "sha512-test" },
  });
  assert.deepEqual(result.errors, []);
  assert.deepEqual(result.warnings, [
    '"engines.kaneo" is ">=2.30.0 <3" but the catalog lists ">=2.29.0 <3"',
    "was published without npm provenance",
  ]);
});

test("reads npm view output", () => {
  assert.deepEqual(readNpmView(JSON.stringify(manifest)), { manifest });
  assert.deepEqual(
    readNpmView(JSON.stringify([{ version: "0.9.0" }, manifest])),
    { manifest },
  );
  assert.deepEqual(
    readNpmView(
      JSON.stringify({ error: { code: "E404", summary: "Not Found" } }),
    ),
    { notFound: true },
  );
  assert.deepEqual(
    readNpmView(
      JSON.stringify({ error: { code: "ETIMEDOUT", summary: "timed out" } }),
    ),
    { error: "timed out" },
  );
  assert.deepEqual(readNpmView("", "npm is not installed"), {
    error: "npm is not installed",
  });
});
