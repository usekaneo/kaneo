import { mkdtempSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { resolveFileSecret } from "../../apps/api/src/utils/file-secret";
import getSettings from "../../apps/api/src/utils/get-settings";

const keys = [
  "CUSTOM_OAUTH_CLIENT_ID",
  "CUSTOM_OAUTH_CLIENT_SECRET",
  "CUSTOM_OAUTH_CLIENT_SECRET_FILE",
] as const;

describe("file-backed secrets", () => {
  const original: Partial<Record<(typeof keys)[number], string | undefined>> =
    {};
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "kaneo-file-secret-"));
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

  it("uses a direct value before its file, even when that file is missing", () => {
    process.env.CUSTOM_OAUTH_CLIENT_SECRET = "direct-secret";
    process.env.CUSTOM_OAUTH_CLIENT_SECRET_FILE = path.join(
      directory,
      "missing",
    );

    expect(resolveFileSecret("CUSTOM_OAUTH_CLIENT_SECRET")).toBe(
      "direct-secret",
    );
  });

  it("reads a file-backed OAuth secret and exposes OAuth availability", () => {
    const file = path.join(directory, "oauth-secret");
    writeFileSync(file, " secret with spaces \r\n");
    process.env.CUSTOM_OAUTH_CLIENT_ID = "client";
    process.env.CUSTOM_OAUTH_CLIENT_SECRET_FILE = file;

    expect(resolveFileSecret("CUSTOM_OAUTH_CLIENT_SECRET")).toBe(
      " secret with spaces ",
    );
    expect(getSettings().hasCustomOAuth).toBe(true);

    unlinkSync(file);
    expect(getSettings().hasCustomOAuth).toBe(true);
  });

  it("rejects missing and empty files instead of silently disabling OAuth", () => {
    const file = path.join(directory, "oauth-secret");
    process.env.CUSTOM_OAUTH_CLIENT_ID = "client";
    process.env.CUSTOM_OAUTH_CLIENT_SECRET_FILE = file;

    expect(() => getSettings()).toThrow(
      "CUSTOM_OAUTH_CLIENT_SECRET_FILE could not be read",
    );

    writeFileSync(file, "\n");
    expect(() => getSettings()).toThrow(
      "CUSTOM_OAUTH_CLIENT_SECRET_FILE points to an empty file",
    );
  });
});
