import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
function runBlock(file, step) {
  const source = readFileSync(
    path.join(root, ".github/workflows", file),
    "utf8",
  );
  const lines = source.slice(source.indexOf(`- name: ${step}`)).split("\n");
  const start = lines.findIndex((line) => line.trim() === "run: |");
  assert.ok(start >= 0);
  const result = [];
  for (const line of lines.slice(start + 1)) {
    if (line.trim() && !line.startsWith("          ")) break;
    result.push(line.slice(10));
  }
  return result.join("\n");
}

const mergeScript = runBlock(
  "auto-merge.yml",
  "Merge eligible npm updates after required checks pass",
);

test("issue notifications preserve untrusted text without Discord mentions", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "kaneo-notification-test-"));
  try {
    const captured = path.join(dir, "payload.json");
    const marker = path.join(dir, "injected");
    writeFileSync(
      path.join(dir, "curl"),
      '#!/bin/sh\nset -eu\nwhile [ "$#" -gt 0 ]; do\n  if [ "$1" = "-d" ]; then shift; printf "%s" "$1" > "$CAPTURED_PAYLOAD"; fi\n  shift\ndone\n',
      { mode: 0o700 },
    );
    const title = `@everyone @here <@12345> <@&67890> "quote"\n$(touch '${marker}')`;
    const result = spawnSync(
      "bash",
      ["-c", runBlock("issue-notify.yml", "Post to Discord")],
      {
        env: {
          PATH: `${dir}:/usr/bin:/bin:/opt/homebrew/bin`,
          CAPTURED_PAYLOAD: captured,
          ISSUE_TITLE: title,
          ISSUE_URL: "https://example.invalid/issues/12",
          ISSUE_NUMBER: "12",
          AUTHOR: "untrusted-author",
          WEBHOOK: "https://example.invalid/never-called",
        },
        encoding: "utf8",
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const payload = JSON.parse(readFileSync(captured, "utf8"));
    assert.deepEqual(payload.allowed_mentions, { parse: [] });
    assert.equal(
      payload.content,
      `New issue #12 by **untrusted-author**: ${title}\nhttps://example.invalid/issues/12`,
    );
    assert.throws(() => readFileSync(marker), { code: "ENOENT" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
const ghMock = `#!/bin/sh
set -eu
case "$1 $2" in
  'api --paginate') printf '%s' "$MOCK_FILES" ;;
  'pr checks')
    case "$*" in
      *--watch*) exit "$MOCK_WATCH_STATUS" ;;
      *) printf '%s' "$MOCK_CHECKS" ;;
    esac ;;
  'pr view') printf '{"headRefOid":"%s"}' "$MOCK_HEAD" ;;
  'pr merge') printf '%s' "$*" > "$MOCK_MERGED" ;;
  *) exit 99 ;;
esac
`;
const success = [{ name: "unit", bucket: "pass" }];
const manifest = [
  { filename: "packages/mcp/package.json", status: "modified" },
];
for (const [name, overrides, allowed] of [
  ["passing required checks permit the verified head", {}, true],
  ["missing required checks reject", { checks: [] }, false],
  ["failing checks reject", { checks: [{ bucket: "fail" }] }, false],
  ["pending checks reject", { checks: [{ bucket: "pending" }] }, false],
  ["skipped checks reject", { checks: [{ bucket: "skipping" }] }, false],
  ["cancelled checks reject", { checks: [{ bucket: "cancel" }] }, false],
  ["watch failure rejects", { watch: 1 }, false],
  ["updated PR head rejects", { head: "different-head" }, false],
  [
    "workflow edits reject",
    { files: [{ filename: ".github/workflows/ci.yml", status: "modified" }] },
    false,
  ],
  [
    "arbitrary source edits reject",
    { files: [{ filename: "apps/api/src/auth.ts", status: "modified" }] },
    false,
  ],
  [
    "renamed manifests reject",
    { files: [{ filename: "package.json", status: "renamed" }] },
    false,
  ],
  ["empty files reject", { files: [] }, false],
  ["malformed checks reject", { checks: null }, false],
]) {
  test(`Dependabot: ${name}`, () => {
    const dir = mkdtempSync(path.join(tmpdir(), "kaneo-merge-test-"));
    try {
      const marker = path.join(dir, "merged");
      writeFileSync(path.join(dir, "gh"), ghMock, { mode: 0o700 });
      const result = spawnSync("bash", ["-c", mergeScript], {
        env: {
          PATH: `${dir}:/usr/bin:/bin:/opt/homebrew/bin`,
          GITHUB_REPOSITORY: "test/repo",
          PR_URL: "https://example.invalid/pull/1",
          PR_NUMBER: "1",
          EXPECTED_HEAD: "reviewed-head",
          MOCK_FILES: JSON.stringify(overrides.files ?? manifest),
          MOCK_CHECKS: JSON.stringify(
            "checks" in overrides ? overrides.checks : success,
          ),
          MOCK_WATCH_STATUS: String(overrides.watch ?? 0),
          MOCK_HEAD: overrides.head ?? "reviewed-head",
          MOCK_MERGED: marker,
        },
        encoding: "utf8",
      });
      if (allowed) {
        assert.equal(result.status, 0, result.stderr);
        assert.match(
          readFileSync(marker, "utf8"),
          /--match-head-commit reviewed-head/,
        );
      } else {
        assert.notEqual(result.status, 0, result.stdout);
        assert.throws(() => readFileSync(marker), { code: "ENOENT" });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
}

for (const version of ["1.2.3", "0.0.1-rc.1", "2.3.4+build.1"]) {
  test(`release version accepts ${version}`, () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/security/validate-release-version.mjs",
        version,
        "--new-version",
      ],
      { cwd: root },
    );
    assert.equal(result.status, 0, String(result.stderr));
  });
}
for (const version of [
  "",
  "1.2",
  "01.2.3",
  "1.2.3-01",
  "1.2.3\nX=bad",
  "$(touch /tmp/kaneo-injection)1.2.3",
  '1.2.3"; exit 0; #',
  "--help",
]) {
  test(`release version rejects ${JSON.stringify(version)}`, () => {
    const result = spawnSync(
      process.execPath,
      [
        "scripts/security/validate-release-version.mjs",
        version,
        "--new-version",
      ],
      { cwd: root },
    );
    assert.notEqual(result.status, 0);
  });
}
test("image and chart version must match checked-out source", () => {
  const version = JSON.parse(
    readFileSync(path.join(root, "package.json")),
  ).version;
  for (const [input, allowed] of [
    [version, true],
    ["9999.0.0", false],
  ]) {
    const result = spawnSync(
      process.execPath,
      ["scripts/security/validate-release-version.mjs", input],
      { cwd: root },
    );
    assert.equal(result.status === 0, allowed);
  }
});

test("release packages reject a tag outside reviewed main history", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "kaneo-release-test-"));
  const git = (...args) => {
    const result = spawnSync("git", args, { cwd: dir, encoding: "utf8" });
    assert.equal(result.status, 0, result.stderr);
    return result.stdout.trim();
  };
  try {
    git("init", "-b", "main");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "reviewed",
    );
    const approved = git("rev-parse", "HEAD");
    git("update-ref", "refs/remotes/origin/main", approved);
    git("checkout", "-b", "unreviewed");
    git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "--allow-empty",
      "-m",
      "unreviewed",
    );
    const unapproved = git("rev-parse", "HEAD");
    for (const workflow of ["publish-mcp.yml", "publish-planka-import.yml"]) {
      const script = runBlock(workflow, "Require reviewed release source");
      for (const [sha, allowed] of [
        [approved, true],
        [unapproved, false],
      ]) {
        const result = spawnSync("bash", ["-c", script], {
          cwd: dir,
          env: {
            PATH: "/usr/bin:/bin:/opt/homebrew/bin",
            EVENT_NAME: "release",
            GITHUB_SHA: sha,
            GITHUB_REF: "refs/tags/package-v1.0.0",
          },
        });
        assert.equal(result.status === 0, allowed, workflow);
      }
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
