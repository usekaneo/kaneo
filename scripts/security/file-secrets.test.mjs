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
const startup = entrypoint.slice(
  0,
  entrypoint.indexOf("/docker-entrypoint.d/env.sh"),
);

function runStartup(env) {
  return spawnSync(
    "sh",
    ["-c", `${startup}\nprintf '%s\\n' "$DATABASE_URL" "$AUTH_SECRET"`],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "",
        POSTGRES_PASSWORD: "",
        POSTGRES_PASSWORD_FILE: "",
        AUTH_SECRET: "",
        AUTH_SECRET_FILE: "",
        ...env,
      },
    },
  );
}

test("bundled startup checks secret files without exporting their contents", () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), "kaneo-entrypoint-secret-"),
  );
  try {
    const passwordFile = path.join(directory, "postgres-password");
    const authFile = path.join(directory, "auth-secret");
    writeFileSync(passwordFile, "space &/#%\n");
    writeFileSync(authFile, `${"a".repeat(32)}\n`);

    const result = runStartup({
      POSTGRES_PASSWORD_FILE: passwordFile,
      AUTH_SECRET_FILE: authFile,
    });

    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(result.stdout.split("\n").slice(-3, -1), ["", ""]);
    assert.doesNotMatch(result.stdout, /space|a{32}/);
    assert.doesNotMatch(result.stdout, /generated a random secret/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("direct values override unreadable secret-file paths", () => {
  const result = runStartup({
    POSTGRES_PASSWORD: "direct-password",
    POSTGRES_PASSWORD_FILE: "/missing/postgres-password",
    AUTH_SECRET: "a".repeat(32),
    AUTH_SECRET_FILE: "/missing/auth-secret",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(result.stdout.trimEnd().split("\n").slice(-2), [
    "postgresql://kaneo:direct-password@postgres:5432/kaneo",
    "a".repeat(32),
  ]);
});

test("unreadable AUTH_SECRET_FILE fails instead of generating a session secret", () => {
  const result = runStartup({
    POSTGRES_PASSWORD: "direct-password",
    AUTH_SECRET_FILE: "/missing/auth-secret",
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /AUTH_SECRET_FILE could not be read \(ENOENT\): \/missing\/auth-secret/,
  );
  assert.doesNotMatch(result.stdout, /generated a random secret/);
});

test("unreadable POSTGRES_PASSWORD_FILE fails before database startup", () => {
  const result = runStartup({
    POSTGRES_PASSWORD_FILE: "/missing/postgres-password",
    AUTH_SECRET: "a".repeat(32),
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /POSTGRES_PASSWORD_FILE could not be read \(ENOENT\): \/missing\/postgres-password/,
  );
});

test("an empty auth secret file fails instead of generating a random value", () => {
  const directory = mkdtempSync(
    path.join(tmpdir(), "kaneo-entrypoint-secret-"),
  );
  try {
    const authFile = path.join(directory, "auth-secret");
    writeFileSync(authFile, "\n");

    const result = runStartup({
      POSTGRES_PASSWORD: "direct-password",
      AUTH_SECRET_FILE: authFile,
    });

    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /AUTH_SECRET_FILE points to an empty file/);
    assert.doesNotMatch(result.stdout, /generated a random secret/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
