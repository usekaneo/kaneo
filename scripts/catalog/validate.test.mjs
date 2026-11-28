import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  DATE_PATTERN,
  DESCRIPTION_MAX_LENGTH,
  ENTRY_FIELDS,
  GITHUB_USERNAME_PATTERN,
  PACKAGE_NAME_MAX_LENGTH,
  PACKAGE_NAME_PATTERN,
  REQUIRED_FIELDS,
  validateCatalog,
  validateEntry,
} from "./validate.mjs";

const readJson = (relative) =>
  JSON.parse(readFileSync(new URL(relative, import.meta.url), "utf8"));

const entry = {
  package: "kaneo-plugin-example",
  repository: "https://github.com/example/kaneo-plugin-example",
  description: "Adds an example view to every project.",
  maintainers: ["octocat"],
  kaneo: ">=2.29.0 <3",
  addedAt: "2026-10-08",
};

test("the committed catalog is valid", () => {
  assert.deepEqual(validateCatalog(readJson("../../catalog/index.json")), []);
});

test("the JSON schema describes the same fields and patterns", () => {
  const schema = readJson("../../catalog/schema.json");
  const plugin = schema.$defs.plugin;
  assert.deepEqual(plugin.required, REQUIRED_FIELDS);
  assert.deepEqual(
    Object.keys(plugin.properties).sort(),
    [...ENTRY_FIELDS].sort(),
  );
  assert.equal(plugin.properties.package.pattern, PACKAGE_NAME_PATTERN);
  assert.equal(plugin.properties.package.maxLength, PACKAGE_NAME_MAX_LENGTH);
  assert.equal(
    plugin.properties.maintainers.items.pattern,
    GITHUB_USERNAME_PATTERN,
  );
  assert.equal(plugin.properties.addedAt.pattern, DATE_PATTERN);
  assert.equal(plugin.properties.description.maxLength, DESCRIPTION_MAX_LENGTH);
});

test("accepts a complete entry with an optional homepage", () => {
  assert.deepEqual(validateEntry(entry), []);
  assert.deepEqual(
    validateEntry({
      ...entry,
      package: "@acme/kaneo-reports",
      homepage: "https://acme.dev",
    }),
    [],
  );
});

test("reports missing and unknown fields", () => {
  const { kaneo: _kaneo, ...withoutRange } = entry;
  assert.deepEqual(validateEntry({ ...withoutRange, stars: 10 }), [
    'unknown field "stars"',
    'missing "kaneo"',
  ]);
  assert.deepEqual(validateEntry("kaneo-plugin-example"), [
    "must be an object",
  ]);
});

test("rejects malformed field values", () => {
  const cases = [
    ["package", "Kaneo-Plugin"],
    ["package", "../evil"],
    ["package", `kaneo-${"a".repeat(PACKAGE_NAME_MAX_LENGTH)}`],
    ["repository", "http://github.com/example/plugin"],
    ["repository", "git@github.com:example/plugin.git"],
    ["repository", "https://user:token@github.com/example/plugin"],
    ["homepage", "javascript:alert(1)"],
    ["description", ""],
    ["description", " Leading space"],
    ["description", "Two\nlines"],
    ["description", "a".repeat(DESCRIPTION_MAX_LENGTH + 1)],
    ["maintainers", []],
    ["maintainers", ["@octocat"]],
    ["maintainers", ["octocat", "Octocat"]],
    ["maintainers", ["-octocat"]],
    ["kaneo", "latest"],
    ["addedAt", "2026-02-30"],
    ["addedAt", "2026-10-08T10:00:00Z"],
  ];
  for (const [field, value] of cases) {
    const errors = validateEntry({ ...entry, [field]: value });
    assert.equal(errors.length, 1, `${field}: ${JSON.stringify(value)}`);
    assert.match(errors[0], new RegExp(`^"${field}" `));
  }
});

test("requires an object with a plugins array", () => {
  assert.deepEqual(validateCatalog([]), ["The catalog must be a JSON object"]);
  assert.deepEqual(validateCatalog({ plugins: {}, extra: true }), [
    'Unknown top-level field "extra"',
    '"plugins" must be an array',
  ]);
});

test("labels entry errors with their position and package", () => {
  assert.deepEqual(
    validateCatalog({ plugins: [{ ...entry, kaneo: "next" }] }),
    [
      'plugins[0] (kaneo-plugin-example): "kaneo" must be a valid semver range, such as ">=2.29.0 <3"',
    ],
  );
});

test("requires entries sorted by package name without duplicates", () => {
  const named = (name) => ({ ...entry, package: name });
  assert.deepEqual(
    validateCatalog({
      plugins: [
        named("@acme/reports"),
        named("kaneo-plugin-a"),
        named("kaneo-plugin-b"),
      ],
    }),
    [],
  );
  assert.deepEqual(
    validateCatalog({
      plugins: [named("kaneo-plugin-b"), named("kaneo-plugin-a")],
    }),
    [
      '"kaneo-plugin-a" must come before "kaneo-plugin-b": keep plugins sorted by package name',
    ],
  );
  assert.deepEqual(
    validateCatalog({
      plugins: [
        named("kaneo-plugin-a"),
        named("kaneo-plugin-a"),
        named("kaneo-plugin-a"),
      ],
    }),
    ['"kaneo-plugin-a" is listed more than once'],
  );
});
