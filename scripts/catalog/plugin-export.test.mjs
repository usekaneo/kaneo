import assert from "node:assert/strict";
import { test } from "node:test";
import { isInsidePackage, readExport } from "./plugin-export.mjs";

test("reads string targets and import or default conditions", () => {
  assert.equal(readExport("./dist/server.js"), "./dist/server.js");
  assert.equal(readExport({ import: "./a.js", default: "./b.js" }), "./a.js");
  assert.equal(readExport({ types: "./a.d.ts", default: "./b.js" }), "./b.js");
  assert.equal(readExport({ import: null, default: "./b.js" }), "./b.js");
  assert.equal(readExport({ import: { default: "./c.js" } }), "./c.js");
});

test("returns null for targets without a usable file", () => {
  for (const target of [
    null,
    undefined,
    "",
    {},
    { types: "./a.d.ts" },
    { require: "./a.cjs" },
    { import: null },
    ["./a.js"],
  ]) {
    assert.equal(readExport(target), null, JSON.stringify(target));
  }
});

test("accepts only relative paths that stay inside the package", () => {
  assert.equal(isInsidePackage("./dist/web/index.js"), true);
  assert.equal(isInsidePackage(".\\dist\\web\\index.js"), true);
  for (const path of [
    "dist/web/index.js",
    "/dist/web/index.js",
    "../web/index.js",
    "./dist/../../web/index.js",
    ".\\..\\web\\index.js",
  ]) {
    assert.equal(isInsidePackage(path), false, path);
  }
});
