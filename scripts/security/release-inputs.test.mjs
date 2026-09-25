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
const workflow = readFileSync(
  resolve(root, ".github/workflows/build-images.yml"),
  "utf8",
);
const command = workflow.match(
  /run: (node scripts\/release\/apply-version\.mjs[^\n]*)/,
)[1];

for (const version of [
  "1.2.3",
  "$(touch injected)1.2.3",
  "`touch injected`1.2.3",
  '1.2.3"; touch injected; #',
  "1.2.3\nOTHER=value",
  "1.2.3\n",
  "01.2.3",
  "1.2.3-01",
  "1.2.3-",
  "1.2.3-rc.1",
]) {
  test(`image stamp treats ${JSON.stringify(version)} as data`, () => {
    const fixture = mkdtempSync(resolve(tmpdir(), "kaneo-release-input-"));
    try {
      mkdirSync(resolve(fixture, "scripts/release"), { recursive: true });
      mkdirSync(resolve(fixture, "charts/kaneo"), { recursive: true });
      copyFileSync(
        resolve(root, "scripts/release/apply-version.mjs"),
        resolve(fixture, "scripts/release/apply-version.mjs"),
      );
      const originalPackage = '{\n  "version": "0.0.0"\n}\n';
      const originalChart = 'version: 0.0.0\nappVersion: "0.0.0"\n';
      writeFileSync(resolve(fixture, "package.json"), originalPackage);
      writeFileSync(resolve(fixture, "charts/kaneo/Chart.yaml"), originalChart);
      const result = spawnSync("sh", ["-c", command], {
        cwd: fixture,
        env: { ...process.env, RELEASE_VERSION: version },
        encoding: "utf8",
      });
      assert.equal(existsSync(resolve(fixture, "injected")), false);
      if (["1.2.3", "1.2.3-rc.1"].includes(version)) {
        assert.equal(result.status, 0, result.stderr);
        assert.equal(
          JSON.parse(readFileSync(resolve(fixture, "package.json"))).version,
          version,
        );
      } else {
        assert.notEqual(result.status, 0);
        assert.equal(
          readFileSync(resolve(fixture, "package.json"), "utf8"),
          originalPackage,
        );
        assert.equal(
          readFileSync(resolve(fixture, "charts/kaneo/Chart.yaml"), "utf8"),
          originalChart,
        );
      }
    } finally {
      rmSync(fixture, { recursive: true, force: true });
    }
  });
}
