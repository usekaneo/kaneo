import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

const root = path.resolve(import.meta.dirname, "../..");
const entrypoint = readFileSync(
  path.join(root, "deploy/kaneo-entrypoint.sh"),
  "utf8",
);
const encoder = entrypoint.slice(
  entrypoint.indexOf("urlencode()"),
  entrypoint.indexOf('api_pid=""'),
);
for (const value of [
  "-password",
  "--require=bad",
  "-p",
  "space &/#%!'",
  "äöü",
]) {
  test(`database credentials preserve ${JSON.stringify(value)}`, () => {
    const result = spawnSync(
      "sh",
      ["-c", `${encoder}\nurlencode "$1"`, "test", value],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(decodeURIComponent(result.stdout), value);
  });
}

test("minimal Compose configuration uses matching DB defaults without a published DB port", () => {
  const dir = mkdtempSync(path.join(tmpdir(), "kaneo-compose-test-"));
  try {
    writeFileSync(
      path.join(dir, "compose.yml"),
      readFileSync(path.join(root, "compose.yml")),
    );
    writeFileSync(
      path.join(dir, ".env"),
      "KANEO_CLIENT_URL=http://localhost:5173\nPOSTGRES_PASSWORD=test-password\nAUTH_SECRET=test-secret-at-least-thirty-two-characters\n",
    );
    const result = spawnSync(
      "docker",
      [
        "compose",
        "--env-file",
        path.join(dir, ".env"),
        "-f",
        path.join(dir, "compose.yml"),
        "config",
        "--format",
        "json",
      ],
      {
        encoding: "utf8",
        env: {
          PATH: "/usr/local/bin:/opt/homebrew/bin:/usr/bin:/bin",
          HOME: process.env.HOME,
        },
      },
    );
    assert.equal(result.status, 0, result.stderr);
    const config = JSON.parse(result.stdout);
    assert.equal(config.services.postgres.environment.POSTGRES_USER, "kaneo");
    assert.equal(config.services.postgres.environment.POSTGRES_DB, "kaneo");
    assert.equal(config.services.postgres.ports, undefined);
    assert.match(config.services.postgres.healthcheck.test[1], /POSTGRES_USER/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
