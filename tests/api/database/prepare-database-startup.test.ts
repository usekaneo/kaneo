import { describe, expect, it, vi } from "vitest";
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
        logConfig: {
          source: "POSTGRES_ENV",
          host: "postgres",
          port: 5432,
          database: "kaneo",
          username: "kaneo",
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
          logConfig: {
            source: "POSTGRES_ENV",
            host: "postgres",
            port: 5432,
            database: "kaneo",
            username: "kaneo",
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
          logConfig: {
            source: "POSTGRES_ENV",
            host: "postgres",
            port: 5432,
            database: "kaneo",
            username: "kaneo",
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
});
