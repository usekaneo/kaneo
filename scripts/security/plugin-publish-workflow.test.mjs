import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(
    new URL("../../.github/workflows/release.yml", import.meta.url),
    "utf8",
  ),
);
const publish = workflow.jobs.npm.steps.find((step) =>
  step.name.startsWith("Publish @kaneo/"),
).run;
const source = "a".repeat(40);

function runPublish(versionSource) {
  const fixture = mkdtempSync(join(tmpdir(), "kaneo-plugin-publish-"));
  try {
    writeFileSync(
      join(fixture, "npm"),
      `#!/bin/sh
if [ "$1" = view ]; then
  published="$FIXTURE_SOURCE"
  if [ "$published" = mixed ]; then
    case "$2" in
      @kaneo/plugin-sdk@*) published=missing ;;
      *) published=unknown ;;
    esac
  fi
  case "$published" in
    missing) exit 1 ;;
    unknown) printf '%s\\n' null ;;
    *) printf '"%s"\\n' "$published" ;;
  esac
else
  printf '%s\\n' "$*"
fi
`,
      { mode: 0o755 },
    );
    writeFileSync(join(fixture, "pnpm"), '#!/bin/sh\nprintf "%s\\n" "$*"\n', {
      mode: 0o755,
    });
    return spawnSync("bash", ["-c", publish], {
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${fixture}:${process.env.PATH}`,
        FIXTURE_SOURCE: versionSource,
        GITHUB_SHA: source,
        RUNNER_TEMP: fixture,
        VERSION: "2.51.0",
      },
    });
  } finally {
    rmSync(fixture, { recursive: true, force: true });
  }
}

test("stamps the source on each newly published plugin package", () => {
  const result = runPublish("missing");
  assert.equal(result.status, 0, result.stderr);
  for (const pkg of ["plugin-sdk", "config"]) {
    assert.ok(
      result.stdout.includes(
        `pkg set kaneoReleaseCommit=${source} --prefix packages/${pkg}`,
      ),
    );
    assert.match(
      result.stdout,
      new RegExp(`publish .*/kaneo-${pkg}-2\\.51\\.0\\.tgz`),
    );
  }
});

test("an npm release retry accepts only versions published from the same source", () => {
  const retry = runPublish(source);
  assert.equal(retry.status, 0, retry.stderr);
  assert.equal(retry.stdout.match(/already published for/g)?.length, 2);

  for (const mismatched of ["b".repeat(40), "unknown"]) {
    const result = runPublish(mismatched);
    assert.equal(result.status, 1, result.stderr);
    assert.match(result.stdout, /different or unknown source/);
    assert.doesNotMatch(result.stdout, /publish .+\.tgz/);
  }
});

test("preflights both package versions before publishing either", () => {
  const result = runPublish("mixed");
  assert.equal(result.status, 1, result.stderr);
  assert.match(
    result.stdout,
    /@kaneo\/config@2\.51\.0 was published for a different or unknown source/,
  );
  assert.doesNotMatch(result.stdout, /publish .+\.tgz/);
});
