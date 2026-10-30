import { describe, expect, it, vi } from "vite-plus/test";
import { prepareDatabaseStartup } from "../../../apps/api/src/database/prepare-database-startup";

describe("prepare-database-startup", () => {
  it("waits for database readiness before running startup migrations", async () => {
    const events: string[] = [];

    await prepareDatabaseStartup({
      resolveConfig: () => ({
        connectionString: "postgresql://kaneo:password@postgres:5432/kaneo",
        source: "POSTGRES_ENV",
        host: "postgres",
        port: 5432,
        database: "kaneo",
        username: "kaneo",
        poolMax: 10,
        logConfig: {
          source: "POSTGRES_ENV",
          host: "postgres",
          port: 5432,
          database: "kaneo",
          username: "kaneo",
          poolMax: 10,
        },
      }),
      waitForDatabase: async () => {
        events.push("wait");
      },
      runStartupMigrations: async () => {
        events.push("migrate");
      },
      logInfo: () => {
        events.push("log");
      },
    });

    expect(events).toEqual(["log", "wait", "migrate"]);
  });

  it("surfaces safe database details and skips migrations when readiness fails", async () => {
    const waitError = new Error("getaddrinfo EAI_AGAIN postgres");
    const runStartupMigrations = vi.fn();
    const logError = vi.fn();

    await expect(
      prepareDatabaseStartup({
        resolveConfig: () => ({
          connectionString: "postgresql://kaneo:password@postgres:5432/kaneo",
          source: "POSTGRES_ENV",
          host: "postgres",
          port: 5432,
          database: "kaneo",
          username: "kaneo",
          poolMax: 10,
          logConfig: {
            source: "POSTGRES_ENV",
            host: "postgres",
            port: 5432,
            database: "kaneo",
            username: "kaneo",
            poolMax: 10,
          },
        }),
        waitForDatabase: async () => {
          throw waitError;
        },
        runStartupMigrations,
        logError,
      }),
    ).rejects.toThrow(
      "Database startup failed for postgres:5432/kaneo (source: POSTGRES_ENV). If you are running outside Docker Compose, use localhost or set DATABASE_URL explicitly.",
    );

    expect(runStartupMigrations).not.toHaveBeenCalled();
    expect(logError).toHaveBeenCalledWith(
      "❌ Database readiness check failed",
      expect.objectContaining({
        source: "POSTGRES_ENV",
        host: "postgres",
        port: 5432,
        database: "kaneo",
        username: "kaneo",
      }),
      waitError,
    );
  });

  it("logs migration failures separately from readiness failures", async () => {
    const migrationError = new Error("permission denied for schema public");
    const logError = vi.fn();

    await expect(
      prepareDatabaseStartup({
        resolveConfig: () => ({
          connectionString: "postgresql://kaneo:password@postgres:5432/kaneo",
          source: "POSTGRES_ENV",
          host: "postgres",
          port: 5432,
          database: "kaneo",
          username: "kaneo",
          poolMax: 10,
          logConfig: {
            source: "POSTGRES_ENV",
            host: "postgres",
            port: 5432,
            database: "kaneo",
            username: "kaneo",
            poolMax: 10,
          },
        }),
        waitForDatabase: async () => undefined,
        runStartupMigrations: async () => {
          throw migrationError;
        },
        logError,
      }),
    ).rejects.toThrow(
      "Database migrations failed for postgres:5432/kaneo (source: POSTGRES_ENV).",
    );

    expect(logError).toHaveBeenCalledWith(
      "❌ Database migrations failed",
      expect.objectContaining({
        source: "POSTGRES_ENV",
        host: "postgres",
        port: 5432,
        database: "kaneo",
        username: "kaneo",
      }),
      migrationError,
    );
  });

  it("logs config resolution failures through the startup wrapper", async () => {
    const configError = new Error(
      "POSTGRES_PASSWORD must be set when deriving DATABASE_URL from POSTGRES_* variables",
    );
    const logError = vi.fn();

    await expect(
      prepareDatabaseStartup({
        resolveConfig: () => {
          throw configError;
        },
        waitForDatabase: async () => undefined,
        runStartupMigrations: async () => undefined,
        logError,
      }),
    ).rejects.toThrow("Database configuration failed during startup.");

    expect(logError).toHaveBeenCalledWith(
      "❌ Database configuration failed",
      configError,
    );
  });

  it("rejects an invalid DATABASE_POOL_MAX before waiting for the database", async () => {
    const original = {
      DATABASE_URL: process.env.DATABASE_URL,
      DATABASE_POOL_MAX: process.env.DATABASE_POOL_MAX,
    };
    process.env.DATABASE_URL =
      "postgresql://kaneo:password@postgres:5432/kaneo";
    process.env.DATABASE_POOL_MAX = "not-a-number";
    const waitForDatabase = vi.fn(async () => undefined);

    try {
      await expect(
        prepareDatabaseStartup({
          waitForDatabase,
          runStartupMigrations: async () => undefined,
          logError: () => undefined,
        }),
      ).rejects.toThrow("Database configuration failed during startup.");

      expect(waitForDatabase).not.toHaveBeenCalled();
    } finally {
      for (const [key, value] of Object.entries(original)) {
        if (value === undefined) {
          delete process.env[key];
        } else {
          process.env[key] = value;
        }
      }
    }
  });
});
