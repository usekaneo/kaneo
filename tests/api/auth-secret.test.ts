import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { resolveAuthSecret } from "../../apps/api/src/utils/auth-secret";

const valid = "a".repeat(32);
const keys = ["AUTH_SECRET", "AUTH_SECRET_FILE"] as const;

describe("AUTH_SECRET resolution", () => {
  const original: Partial<Record<(typeof keys)[number], string | undefined>> =
    {};
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "kaneo-auth-secret-"));
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it.each([undefined, ""])(
    "refuses to start when AUTH_SECRET is %p",
    (value) => {
      expect(() => resolveAuthSecret(value)).toThrow(/AUTH_SECRET is not set/);
    },
  );

  it("never returns Better Auth's default secret", () => {
    expect(() =>
      resolveAuthSecret("better-auth-secret-12345678901234567890"),
    ).not.toThrow();
    expect(resolveAuthSecret(valid)).not.toBe(
      "better-auth-secret-12345678901234567890",
    );
  });

  it("rejects a secret shorter than 32 characters", () => {
    expect(() => resolveAuthSecret("a".repeat(31))).toThrow(/less than 32/);
  });

  it("accepts a secret of exactly 32 characters", () => {
    expect(resolveAuthSecret(valid)).toBe(valid);
  });

  it("reads AUTH_SECRET_FILE when the direct value is absent", () => {
    const file = path.join(directory, "auth-secret");
    writeFileSync(file, `${valid}\n`);
    process.env.AUTH_SECRET_FILE = file;

    expect(resolveAuthSecret()).toBe(valid);
    unlinkSync(file);
    expect(resolveAuthSecret()).toBe(valid);
  });

  it("keeps direct AUTH_SECRET precedence over an invalid file path", () => {
    process.env.AUTH_SECRET = valid;
    process.env.AUTH_SECRET_FILE = path.join(directory, "missing");

    expect(resolveAuthSecret()).toBe(valid);
  });

  it("rejects a missing or short file-backed AUTH_SECRET", () => {
    const file = path.join(directory, "auth-secret");
    process.env.AUTH_SECRET_FILE = file;
    expect(() => resolveAuthSecret()).toThrow(
      "AUTH_SECRET_FILE could not be read",
    );

    writeFileSync(file, "short\n");
    expect(() => resolveAuthSecret()).toThrow(/less than 32/);
  });
});
