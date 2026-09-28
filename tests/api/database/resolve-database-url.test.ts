import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import {
  resolveDatabaseConfig,
  resolveDatabaseConnectionString,
} from "../../../apps/api/src/database/resolve-database-url";

const keys = [
  "DATABASE_URL",
  "POSTGRES_HOST",
  "POSTGRES_PORT",
  "POSTGRES_DB",
  "POSTGRES_USER",
  "POSTGRES_PASSWORD",
  "POSTGRES_PASSWORD_FILE",
] as const;

describe("resolve-database-url", () => {
  const original: Partial<Record<(typeof keys)[number], string | undefined>> =
    {};
  let directory: string;

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "kaneo-db-secret-"));
    for (const key of keys) {
      original[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = original[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    rmSync(directory, { recursive: true, force: true });
  });

  it("returns DATABASE_URL unchanged when explicitly configured", () => {
    process.env.DATABASE_URL = "postgresql://app:secret@example.com:5433/appdb";

    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://app:secret@example.com:5433/appdb",
    );

    expect(resolveDatabaseConfig()).toMatchObject({
      connectionString: "postgresql://app:secret@example.com:5433/appdb",
      source: "DATABASE_URL",
      host: "example.com",
      port: 5433,
      database: "appdb",
      username: "app",
    });
  });

  it("derives DATABASE_URL from POSTGRES_* when a derivation signal is present", () => {
    process.env.POSTGRES_PASSWORD = "password";
    process.env.POSTGRES_HOST = "db.internal";
    process.env.POSTGRES_PORT = "6543";
    process.env.POSTGRES_DB = "kaneo_dev";
    process.env.POSTGRES_USER = "kaneo";

    expect(resolveDatabaseConfig()).toMatchObject({
      connectionString:
        "postgresql://kaneo:password@db.internal:6543/kaneo_dev",
      source: "POSTGRES_ENV",
      host: "db.internal",
      port: 6543,
      database: "kaneo_dev",
      username: "kaneo",
    });
  });

  it("uses bundled-image defaults when deriving from POSTGRES_PASSWORD alone", () => {
    process.env.POSTGRES_PASSWORD = "password";

    expect(resolveDatabaseConfig()).toMatchObject({
      connectionString: "postgresql://kaneo:password@postgres:5432/kaneo",
      source: "POSTGRES_ENV",
      host: "postgres",
      port: 5432,
      database: "kaneo",
      username: "kaneo",
    });
  });

  it("derives and URL-encodes POSTGRES_PASSWORD_FILE when no direct password exists", () => {
    const file = path.join(directory, "db-password");
    writeFileSync(file, "space &/#%!'\n");
    process.env.POSTGRES_PASSWORD_FILE = file;

    expect(resolveDatabaseConfig()).toMatchObject({
      connectionString:
        "postgresql://kaneo:space%20%26%2F%23%25!'@postgres:5432/kaneo",
      source: "POSTGRES_ENV",
    });
  });

  it("keeps direct database credentials ahead of file credentials", () => {
    process.env.POSTGRES_PASSWORD = "direct";
    process.env.POSTGRES_PASSWORD_FILE = path.join(directory, "missing");
    expect(resolveDatabaseConnectionString()).toBe(
      "postgresql://kaneo:direct@postgres:5432/kaneo",
    );

    process.env.DATABASE_URL = "postgresql://app:db@example.com/app";
    process.env.POSTGRES_PASSWORD = "";
    expect(resolveDatabaseConnectionString()).toBe(process.env.DATABASE_URL);
  });

  it("fails when POSTGRES_PASSWORD_FILE is missing or empty", () => {
    const file = path.join(directory, "db-password");
    process.env.POSTGRES_PASSWORD_FILE = file;
    expect(() => resolveDatabaseConfig()).toThrow(
      "POSTGRES_PASSWORD_FILE could not be read",
    );

    writeFileSync(file, "\n");
    expect(() => resolveDatabaseConfig()).toThrow(
      "POSTGRES_PASSWORD_FILE points to an empty file",
    );
  });

  it("preserves the localhost fallback when only POSTGRES_DB and POSTGRES_USER are set", () => {
    process.env.POSTGRES_DB = "kaneo";
    process.env.POSTGRES_USER = "kaneo";

    expect(resolveDatabaseConfig()).toMatchObject({
      connectionString: "postgresql://localhost:5432/kaneo",
      source: "LOCAL_FALLBACK",
      host: "localhost",
      port: 5432,
      database: "kaneo",
      username: "",
    });
  });

  it("throws when derivation is attempted without POSTGRES_PASSWORD", () => {
    process.env.POSTGRES_HOST = "db.internal";

    expect(() => resolveDatabaseConfig()).toThrow(
      "POSTGRES_PASSWORD must be set when deriving DATABASE_URL from POSTGRES_* variables",
    );
  });

  it("exposes safe metadata without a password field", () => {
    process.env.POSTGRES_PASSWORD = "super-secret";

    const config = resolveDatabaseConfig();

    expect(config.logConfig).not.toHaveProperty("password");
    expect(JSON.stringify(config.logConfig)).not.toContain("super-secret");
  });
});
