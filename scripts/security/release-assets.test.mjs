import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const workflow = path.join(root, ".github/workflows/release.yml");

function runBlock(file, step) {
  const source = readFileSync(file, "utf8");
  const lines = source.slice(source.indexOf(`- name: ${step}`)).split("\n");
  const start = lines.findIndex((line) => line.trim().startsWith("run:"));
  assert.ok(start >= 0, `${step} has no run step`);
  const inline = lines[start].trim().slice(4).trim();
  if (inline !== "|") return inline;
  const result = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !line.startsWith("          ")) break;
    result.push(line.slice(10));
  }
  return result.join("\n");
}

function fixture() {
  const dir = mkdtempSync(path.join(tmpdir(), "kaneo-release-assets-"));
  const bin = path.join(dir, "bin");
  const work = path.join(dir, "work");
  mkdirSync(path.join(work, "apps/web/dist"), { recursive: true });
  writeFileSync(
    path.join(work, "apps/web/dist/index.html"),
    "<!doctype html>\n",
  );
  writeFileSync(path.join(work, "apps/web/env.sh"), "#!/bin/sh\n");
  writeFileSync(path.join(work, "apps/web/env.awk"), "BEGIN {}\n");
  mkdirSync(bin, { recursive: true });
  return { dir, bin, work };
}

function stub(bin, name, variable) {
  writeFileSync(
    path.join(bin, name),
    `#!/bin/sh\nprintf '%s\\n' "$*" >> "$${variable}"\n`,
    { mode: 0o700 },
  );
}

function run(script, { dir, bin, work }, env) {
  return spawnSync("bash", ["-c", script], {
    cwd: work,
    env: {
      ...process.env,
      PATH: `${bin}:/usr/bin:/bin`,
      RUNNER_TEMP: path.join(dir, "runner"),
      ...env,
    },
    encoding: "utf8",
  });
}

test("release assets archive the versioned web dist with its env helpers", () => {
  const parts = fixture();
  try {
    const calls = path.join(parts.dir, "pnpm-calls");
    stub(parts.bin, "pnpm", "PNPM_CALLS");
    const result = run(runBlock(workflow, "Build release assets"), parts, {
      VERSION: "1.2.3",
      PNPM_CALLS: calls,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(calls, "utf8"),
      "--filter @kaneo/permissions build\n--filter @kaneo/web build\n",
    );
    const tarball = path.join(
      parts.dir,
      "runner/release-assets/kaneo-web-1.2.3.tar.gz",
    );
    const listing = spawnSync("tar", ["-tzf", tarball], { encoding: "utf8" });
    assert.equal(listing.status, 0, listing.stderr);
    assert.deepEqual(listing.stdout.trim().split("\n").sort(), [
      "kaneo-web-1.2.3/",
      "kaneo-web-1.2.3/dist/",
      "kaneo-web-1.2.3/dist/index.html",
      "kaneo-web-1.2.3/env.awk",
      "kaneo-web-1.2.3/env.sh",
    ]);
  } finally {
    rmSync(parts.dir, { recursive: true, force: true });
  }
});

test("release assets attach to the released tag", () => {
  const parts = fixture();
  try {
    const calls = path.join(parts.dir, "gh-calls");
    stub(parts.bin, "gh", "GH_CALLS");
    const assets = path.join(parts.dir, "runner/release-assets");
    mkdirSync(assets, { recursive: true });
    writeFileSync(path.join(assets, "kaneo-web-1.2.3.tar.gz"), "stub");
    const result = run(runBlock(workflow, "Attach release assets"), parts, {
      VERSION: "1.2.3",
      GH_CALLS: calls,
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      readFileSync(calls, "utf8"),
      `release upload v1.2.3 ${assets}/kaneo-web-1.2.3.tar.gz\n`,
    );
  } finally {
    rmSync(parts.dir, { recursive: true, force: true });
  }
});

test("release asset naming treats the version as data", () => {
  const parts = fixture();
  try {
    stub(parts.bin, "pnpm", "PNPM_CALLS");
    const result = run(runBlock(workflow, "Build release assets"), parts, {
      VERSION: "$(touch injected)1.2.3",
      PNPM_CALLS: path.join(parts.dir, "pnpm-calls"),
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(existsSync(path.join(parts.work, "injected")), false);
    assert.deepEqual(
      readdirSync(path.join(parts.dir, "runner/release-assets")),
      ["kaneo-web-$(touch injected)1.2.3.tar.gz"],
    );
  } finally {
    rmSync(parts.dir, { recursive: true, force: true });
  }
});
