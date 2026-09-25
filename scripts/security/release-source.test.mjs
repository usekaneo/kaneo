import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";

const root = resolve(import.meta.dirname, "../..");
function fixture(run) {
  const dir = mkdtempSync(resolve(tmpdir(), "kaneo-source-test-"));
  const git = (...args) => {
    const result = spawnSync(
      "git",
      [
        "-c",
        "user.name=Test",
        "-c",
        "user.email=test@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "-c",
        "core.hooksPath=/dev/null",
        ...args,
      ],
      { cwd: dir, encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  const versions = (pkg = "1.2.3", chart = pkg) => {
    writeFileSync(
      resolve(dir, "package.json"),
      JSON.stringify({ version: pkg, type: "module" }),
    );
    writeFileSync(
      resolve(dir, "charts/kaneo/Chart.yaml"),
      `name: kaneo\nversion: ${chart}\nappVersion: "${pkg}"\n`,
    );
  };
  const commit = () => {
    git("add", ".");
    git("commit", "--allow-empty", "-m", "fixture");
    return git("rev-parse", "HEAD");
  };
  try {
    mkdirSync(resolve(dir, "charts/kaneo"), { recursive: true });
    mkdirSync(resolve(dir, "scripts/security"), { recursive: true });
    mkdirSync(resolve(dir, "scripts/release"), { recursive: true });
    for (const file of [
      "scripts/security/verify-release-source.mjs",
      "scripts/security/validate-release-version.mjs",
      "scripts/release/emit-version.mjs",
    ])
      copyFileSync(resolve(root, file), resolve(dir, file));
    versions();
    git("init", "-b", "main");
    const first = commit();
    git("update-ref", "refs/remotes/origin/main", first);
    const verify = (mode, version, extra = {}) => {
      const output = resolve(dir, "output");
      rmSync(output, { force: true });
      const result = spawnSync(
        process.execPath,
        ["scripts/security/verify-release-source.mjs", mode, version],
        {
          cwd: dir,
          encoding: "utf8",
          env: {
            PATH: process.env.PATH,
            GITHUB_REF: "refs/heads/main",
            GITHUB_SHA: git("rev-parse", "HEAD"),
            GITHUB_OUTPUT: output,
            ...extra,
          },
        },
      );
      return {
        ...result,
        output: existsSync(output) ? readFileSync(output, "utf8") : "",
      };
    };
    run({ dir, git, commit, first, versions, verify });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test("an existing release resolves its reviewed tag, not newer main", () =>
  fixture(({ git, first, commit, versions, verify }) => {
    git("tag", "v1.2.3");
    versions("1.2.4");
    const latest = commit();
    git("update-ref", "refs/remotes/origin/main", latest);
    const result = verify("released", "1.2.3");
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.output, `source_sha=${first}\n`);
  }));
test("tags outside reviewed main history cannot publish", () =>
  fixture(({ git, commit, verify }) => {
    git("checkout", "-b", "unreviewed");
    commit();
    git("tag", "v1.2.3");
    git("checkout", "main");
    assert.notEqual(verify("released", "1.2.3").status, 0);
  }));
test("a nonexistent tag cannot be manufactured by version stamping", () =>
  fixture(({ verify }) => {
    assert.notEqual(verify("released", "1.2.3").status, 0);
  }));
test("tag and package version must match", () =>
  fixture(({ git, verify }) => {
    git("tag", "v9.0.0");
    assert.notEqual(verify("released", "9.0.0").status, 0);
  }));
test("tag and chart version must match", () =>
  fixture(({ git, commit, versions, verify }) => {
    versions("1.2.3", "9.0.0");
    const sha = commit();
    git("update-ref", "refs/remotes/origin/main", sha);
    git("tag", "v1.2.3");
    assert.notEqual(verify("released", "1.2.3").status, 0);
  }));
test("publication requires a main workflow and the exact workflow checkout", () =>
  fixture(({ first, verify }) => {
    assert.notEqual(
      verify("planned", "1.2.4", { GITHUB_REF: "refs/heads/unreviewed" })
        .status,
      0,
    );
    assert.notEqual(
      verify("planned", "1.2.4", { GITHUB_SHA: "0".repeat(40) }).status,
      0,
    );
    assert.equal(verify("planned", "1.2.4", { GITHUB_SHA: first }).status, 0);
  }));
test("planned release cannot silently follow a moving main branch", () =>
  fixture(({ first, git, commit, verify }) => {
    const latest = commit();
    git("update-ref", "refs/remotes/origin/main", latest);
    git("checkout", "--detach", first);
    assert.notEqual(verify("planned", "1.2.4").status, 0);
  }));
test("planned release refuses an existing version tag", () =>
  fixture(({ git, verify }) => {
    git("tag", "v1.2.4");
    assert.notEqual(verify("planned", "1.2.4").status, 0);
  }));
test("a new planned release and unversioned nightly retain the workflow SHA", () =>
  fixture(({ first, verify }) => {
    for (const [mode, version] of [
      ["planned", "1.2.4"],
      ["nightly", ""],
    ]) {
      const result = verify(mode, version);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.output, `source_sha=${first}\n`);
    }
    assert.notEqual(verify("nightly", "1.2.3").status, 0);
    assert.notEqual(verify("unknown", "1.2.3").status, 0);
  }));
test("malformed release inputs cannot execute code or produce workflow outputs", () =>
  fixture(({ dir, verify }) => {
    for (const version of [
      "1.2.3\nSOURCE=bad",
      "$(touch injected)",
      "1.2.3\n",
      "--help",
    ]) {
      const result = verify("released", version);
      assert.notEqual(result.status, 0);
      assert.equal(result.output, "");
      assert.equal(existsSync(resolve(dir, "injected")), false);
    }
  }));
test("semantic-release rejects version drift at verifyRelease before emitting output", () =>
  fixture(({ dir }) => {
    for (const version of ["1.2.4", "1.2.5"]) {
      const output = resolve(dir, `verify-${version}`);
      const result = spawnSync(
        process.execPath,
        ["scripts/release/emit-version.mjs", version],
        {
          cwd: dir,
          encoding: "utf8",
          env: {
            PATH: process.env.PATH,
            PLANNED_VERSION: "1.2.4",
            GITHUB_OUTPUT: output,
          },
        },
      );
      if (version === "1.2.4") {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(readFileSync(output, "utf8"), "version=1.2.4\n");
      } else {
        assert.notEqual(result.status, 0);
        assert.equal(existsSync(output), false);
      }
    }
  }));
