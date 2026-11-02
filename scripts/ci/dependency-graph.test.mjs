import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parseAllDocuments, stringify } from "yaml";
import {
  dependencyKey,
  packageIdentity,
} from "./dependency-graph-identity.mjs";
import { buildManifest } from "./dependency-graph-lock.mjs";
import { buildSnapshot, lockPaths } from "./dependency-graph-snapshot.mjs";
import { main } from "./dependency-graph.mjs";

// Reduced from the actual pnpm 12 locks: environment document first, then the
// workspace graph with catalog aliases, linked importers, peers and patches.
const environment = `---
lockfileVersion: '9.0'
importers:
  .:
    configDependencies: {}
    packageManagerDependencies:
      pnpm: {specifier: 12.15.0, version: 12.15.0}
packages:
  pnpm@12.15.0: {resolution: {integrity: sha512-fixture}}
snapshots:
  pnpm@12.15.0: {}
`;
const application = `---
lockfileVersion: '9.0'
settings: {autoInstallPeers: true, excludeLinksFromLockfile: false}
importers:
  .:
    dependencies:
      vite: {specifier: 'catalog:', version: '@voidzero-dev/vite-plus-core@1.4.0(qs@6.16.2)'}
      shared: {specifier: 'workspace:*', version: 'link:packages/shared'}
    devDependencies:
      browserstack-node-sdk: {specifier: 1.75.1, version: '1.75.1(qs@6.16.2)'}
  packages/shared:
    dependencies:
      node-forge: {specifier: 1.4.2, version: 1.4.2}
packages:
  '@voidzero-dev/vite-plus-core@1.4.0': {resolution: {integrity: sha512-fixture}}
  browserstack-node-sdk@1.75.1: {resolution: {integrity: sha512-fixture}}
  node-forge@1.4.2: {resolution: {integrity: sha512-fixture}}
  qs@6.16.2: {resolution: {integrity: sha512-fixture}}
  deepmerge@4.3.1: {resolution: {integrity: sha512-fixture}}
  fsevents@2.3.3: {resolution: {integrity: sha512-fixture}, os: [darwin]}
  orphan@1.0.0: {resolution: {integrity: sha512-fixture}}
snapshots:
  '@voidzero-dev/vite-plus-core@1.4.0(qs@6.16.2)':
    dependencies:
      qs: 6.16.2
      merged: deepmerge@4.3.1(patch_hash=abcdef)
    optionalDependencies:
      fsevents: 2.3.3
    transitivePeerDependencies: [unresolved-peer]
  browserstack-node-sdk@1.75.1(qs@6.16.2):
    dependencies:
      qs: 6.16.2
  node-forge@1.4.2: {}
  qs@6.16.2: {}
  deepmerge@4.3.1(patch_hash=abcdef): {}
  fsevents@2.3.3: {optional: true}
  orphan@1.0.0: {}
`;
const fixture = environment + application;
const context = {
  sha: "a".repeat(40),
  ref: "refs/heads/main",
  runId: "123-1",
  scanned: "2026-11-02T00:00:00.000Z",
};
const sources = Object.fromEntries(lockPaths.map((path) => [path, fixture]));

function changedApplication(change) {
  const lock = parseAllDocuments(application)[0].toJS();
  change(lock);
  return `${environment}---\n${stringify(lock)}`;
}

// Assertions mirror the official REST snapshot/manifest/dependency schemas:
// https://github.com/github/rest-api-description (components/schemas/snapshot).
// No network or file writes are needed to validate a constructed payload.
function assertPayload(snapshot) {
  assert.deepEqual(Object.keys(snapshot).sort(), [
    "detector",
    "job",
    "manifests",
    "ref",
    "scanned",
    "sha",
    "version",
  ]);
  assert.equal(snapshot.version, 0);
  assert.match(snapshot.sha, /^(?:[a-f\d]{40}|[a-f\d]{64})$/i);
  assert.match(snapshot.ref, /^refs\//);
  assert.ok(Number.isFinite(Date.parse(snapshot.scanned)));
  assert.deepEqual(Object.keys(snapshot.job).sort(), ["correlator", "id"]);
  assert.deepEqual(Object.keys(snapshot.detector).sort(), [
    "name",
    "url",
    "version",
  ]);
  const descriptions = [
    ...Object.values(snapshot.job),
    ...Object.values(snapshot.detector),
  ];
  for (const value of descriptions) {
    assert.equal(typeof value, "string");
    assert.ok(value.length);
  }
  assert.deepEqual(Object.keys(snapshot.manifests), lockPaths);
  for (const [path, manifest] of Object.entries(snapshot.manifests)) {
    assert.deepEqual(Object.keys(manifest).sort(), [
      "file",
      "name",
      "resolved",
    ]);
    assert.equal(manifest.name, path);
    assert.deepEqual(manifest.file, { source_location: path });
    assert.ok(Object.keys(manifest.resolved).length);
    for (const [key, entry] of Object.entries(manifest.resolved)) {
      assert.equal(entry.package_url, key);
      assert.match(key, /^pkg:npm\//);
      const fields = ["package_url", "relationship", "scope", "dependencies"];
      assert.ok(Object.keys(entry).every((field) => fields.includes(field)));
      if (entry.relationship) {
        assert.ok(["direct", "indirect"].includes(entry.relationship));
      }
      if (entry.scope) {
        assert.ok(["runtime", "development"].includes(entry.scope));
      }
      assert.ok(Array.isArray(entry.dependencies));
      for (const dependency of entry.dependencies) {
        assert.equal(typeof dependency, "string");
        assert.ok(Object.hasOwn(manifest.resolved, dependency));
      }
    }
  }
}

test("npm identities retain real names and versions, removing only pnpm contexts", () => {
  assert.equal(
    packageIdentity("@scope/pkg@1.2.3(peer@4.5.6(nested@7.8.9))").purl,
    "pkg:npm/%40scope/pkg@1.2.3",
  );
  assert.equal(
    packageIdentity("deepmerge@4.3.1(patch_hash=abcdef)").purl,
    "pkg:npm/deepmerge@4.3.1",
  );
  assert.equal(
    packageIdentity("pkg@1.0.0-rc.1+build.2").purl,
    "pkg:npm/pkg@1.0.0-rc.1%2Bbuild.2",
  );
  assert.equal(
    dependencyKey("alias", "@scope/actual@1.2.3(peer@2.0.0)"),
    "@scope/actual@1.2.3(peer@2.0.0)",
  );
  assert.equal(dependencyKey("alias", "npm:actual@1.2.3"), "actual@1.2.3");
  assert.equal(dependencyKey("alias", "2g@1.0.1"), "2g@1.0.1");
  assert.equal(dependencyKey("@scope/pkg", "1.2.3"), "@scope/pkg@1.2.3");
  for (const value of [
    "pkg@https://example.com/a.tgz",
    "pkg@latest",
    "pkg@1.2.3(unclosed",
    "pkg@1.2.3(peer@1.0.0)junk",
  ]) {
    assert.throws(() => packageIdentity(value));
  }
});

test("selects the main graph in either document order, retaining all packages and edges", () => {
  const manifest = buildManifest(fixture, lockPaths[0]);
  assert.deepEqual(
    buildManifest(application + environment, lockPaths[0]),
    manifest,
  );
  const entries = manifest.resolved;
  assert.equal(Object.keys(entries).length, 7);
  assert.ok(!Object.hasOwn(entries, "pkg:npm/pnpm@12.15.0"));
  assert.ok(!Object.hasOwn(entries, "pkg:npm/vite@1.4.0"));
  assert.deepEqual(
    entries["pkg:npm/%40voidzero-dev/vite-plus-core@1.4.0"].dependencies,
    ["pkg:npm/deepmerge@4.3.1", "pkg:npm/fsevents@2.3.3", "pkg:npm/qs@6.16.2"],
  );
  assert.equal(entries["pkg:npm/qs@6.16.2"].relationship, "indirect");
  assert.equal(entries["pkg:npm/qs@6.16.2"].scope, "runtime");
  assert.equal(entries["pkg:npm/node-forge@1.4.2"].relationship, "direct");
  assert.equal(
    entries["pkg:npm/browserstack-node-sdk@1.75.1"].scope,
    "development",
  );
  assert.equal(entries["pkg:npm/fsevents@2.3.3"].scope, "runtime");
  assert.deepEqual(entries["pkg:npm/orphan@1.0.0"], {
    package_url: "pkg:npm/orphan@1.0.0",
    dependencies: [],
  });
});

test("merges edges from peer variants without losing packages or mistaking development for runtime", () => {
  const source = changedApplication((lock) => {
    lock.snapshots["browserstack-node-sdk@1.75.1(qs@6.16.1)"] = {
      dependencies: { orphan: "1.0.0" },
    };
    lock.importers["."].devDependencies.second = {
      version: "browserstack-node-sdk@1.75.1(qs@6.16.1)",
    };
  });
  const entries = buildManifest(source, lockPaths[0]).resolved;
  assert.equal(Object.keys(entries).length, 7);
  assert.deepEqual(
    entries["pkg:npm/browserstack-node-sdk@1.75.1"].dependencies,
    ["pkg:npm/orphan@1.0.0", "pkg:npm/qs@6.16.2"],
  );
  assert.equal(entries["pkg:npm/orphan@1.0.0"].scope, "development");
});

test("fails closed on malformed, ambiguous, empty or incomplete locks", () => {
  const invalid = [
    environment,
    fixture + application,
    "---\nlockfileVersion: [broken",
    fixture.replace("lockfileVersion: '9.0'", "lockfileVersion: '10.0'"),
    application.replace("settings:", "lockfileVersion: '9.0'\nsettings:"),
    changedApplication((lock) => {
      lock.packages = {};
    }),
    changedApplication((lock) => {
      lock.snapshots = {};
    }),
    changedApplication((lock) => {
      delete lock.snapshots["qs@6.16.2"];
    }),
    changedApplication((lock) => {
      delete lock.packages["qs@6.16.2"];
    }),
    changedApplication((lock) => {
      lock.packages["unsupported@file:../pkg"] = {};
    }),
    changedApplication((lock) => {
      lock.snapshots["qs@6.16.2"].dependencies = { missing: "1.0.0" };
    }),
    changedApplication((lock) => {
      lock.snapshots["qs@6.16.2"].optionalDependencies = { missing: "1.0.0" };
    }),
    changedApplication((lock) => {
      lock.importers["."].dependencies.missing = { version: "1.0.0" };
    }),
    changedApplication((lock) => {
      lock.importers["."].dependencies.shared.version = "link:missing";
    }),
    changedApplication((lock) => {
      lock.importers["."].dependencies = null;
    }),
    changedApplication((lock) => {
      lock.importers = { ".": { dependencies: {} } };
    }),
  ];
  for (const source of invalid) {
    assert.throws(() => buildManifest(source, lockPaths[0]));
  }
});

test("one stable snapshot contains two distinct manifests at the same commit", () => {
  const snapshot = buildSnapshot(sources, context);
  assertPayload(snapshot);
  assert.equal(snapshot.sha, context.sha);
  const next = buildSnapshot(sources, { ...context, runId: "124-2" });
  assert.equal(snapshot.job.correlator, next.job.correlator);
  assert.equal(snapshot.detector.name, next.detector.name);
  assert.notEqual(snapshot.job.id, next.job.id);
  assert.throws(() => buildSnapshot({ [lockPaths[0]]: fixture }, context));
  assert.throws(() => buildSnapshot(sources, { ...context, sha: "main" }));
  assert.throws(() =>
    buildSnapshot(sources, { ...context, ref: "refs/heads/untrusted" }),
  );
  assert.throws(() =>
    buildSnapshot(sources, { ...context, scanned: "invalid" }),
  );
});

test("actual root and e2e locks cover every main-document package with valid payloads", async () => {
  const actual = Object.fromEntries(
    await Promise.all(
      lockPaths.map(async (path) => [path, await readFile(path, "utf8")]),
    ),
  );
  const snapshot = buildSnapshot(actual, context);
  assertPayload(snapshot);
  for (const path of lockPaths) {
    const documents = parseAllDocuments(actual[path]).map((document) =>
      document.toJS(),
    );
    const lock = documents.find((document) => document.settings);
    assert.ok(lock);
    const expected = [
      ...new Set(
        Object.keys(lock.packages).map((key) => packageIdentity(key).purl),
      ),
    ].sort();
    assert.deepEqual(
      Object.keys(snapshot.manifests[path].resolved).sort(),
      expected,
    );
  }
  for (const name of ["qs", "node-forge", "deepmerge"]) {
    assert.ok(
      Object.keys(snapshot.manifests[lockPaths[0]].resolved).some((key) =>
        key.startsWith(`pkg:npm/${name}@`),
      ),
    );
  }
  assert.ok(
    Object.keys(snapshot.manifests[lockPaths[1]].resolved).some((key) =>
      key.startsWith("pkg:npm/browserstack-node-sdk@"),
    ),
  );
});

test("CLI dry-run builds the real payload without networking or file writes", async (t) => {
  // Node's test runner also uses stdout for its binary protocol. Capture a
  // separate CLI process instead of intercepting that protocol in this worker.
  const code = `
    globalThis.fetch = () => { throw new Error("Unexpected network access"); };
    const { main } = await import("./scripts/ci/dependency-graph.mjs");
    await main(["--dry-run"], ${JSON.stringify({ GITHUB_SHA: context.sha, GITHUB_REF: context.ref })});
  `;
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  const output = execFileSync(
    process.execPath,
    ["--input-type=module", "--eval", code],
    {
      env,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
    },
  );
  assertPayload(JSON.parse(output));
  const network = t.mock.method(globalThis, "fetch", () => {
    throw new Error("Unexpected network access");
  });
  assert.equal(network.mock.callCount(), 0);
  await assert.rejects(
    main(["--submit"], {
      GITHUB_SHA: context.sha,
      GITHUB_REF: "refs/heads/other",
    }),
  );
  await assert.rejects(
    main(["--submit"], {
      GITHUB_SHA: context.sha,
      GITHUB_REF: context.ref,
      GITHUB_ACTIONS: "true",
      GITHUB_EVENT_NAME: "pull_request",
    }),
  );
  assert.equal(network.mock.callCount(), 0);
});

test("trusted submission sends one complete snapshot to GitHub and rejects unsuccessful responses", async (t) => {
  t.mock.method(console, "log", () => {});
  const env = {
    GITHUB_SHA: context.sha,
    GITHUB_REF: context.ref,
    GITHUB_ACTIONS: "true",
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REPOSITORY: "usekaneo/kaneo",
    GITHUB_RUN_ID: "123",
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_TOKEN: "synthetic-test-token",
  };
  const network = t.mock.method(globalThis, "fetch", async (url, options) => {
    assert.equal(
      url,
      "https://api.github.com/repos/usekaneo/kaneo/dependency-graph/snapshots",
    );
    assert.equal(options.method, "POST");
    assert.equal(options.redirect, "error");
    assert.equal(options.headers.Authorization, "Bearer synthetic-test-token");
    const payload = JSON.parse(options.body);
    assertPayload(payload);
    assert.equal(payload.sha, context.sha);
    assert.equal(payload.job.id, "123-2");
    return Response.json({ result: "SUCCESS" }, { status: 201 });
  });
  await main(["--submit"], env);
  assert.equal(network.mock.callCount(), 1);
  network.mock.mockImplementation(async () =>
    Response.json({ result: "ERROR" }, { status: 201 }),
  );
  await assert.rejects(main(["--submit"], env), /did not report SUCCESS/);
  network.mock.mockImplementation(
    async () => new Response(null, { status: 403 }),
  );
  await assert.rejects(main(["--submit"], env), /HTTP 403/);
});
