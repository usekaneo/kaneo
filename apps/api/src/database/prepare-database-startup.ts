import type { ResolvedDatabaseConfig } from "./resolve-database-url";
import { resolveDatabaseConfig } from "./resolve-database-url";

type PrepareDatabaseStartupOptions = {
  resolveConfig?: () => ResolvedDatabaseConfig;
  waitForDatabase: () => Promise<void>;
  runStartupMigrations: () => Promise<void>;
  logInfo?: (message: string, ...args: unknown[]) => void;
  logError?: (message: string, ...args: unknown[]) => void;
};

export async function prepareDatabaseStartup({
  resolveConfig = resolveDatabaseConfig,
  waitForDatabase,
  runStartupMigrations,
  logInfo = console.log,
  logError = console.error,
}: PrepareDatabaseStartupOptions): Promise<void> {
  let config: ResolvedDatabaseConfig;

  try {
    config = resolveConfig();
  } catch (error) {
    logError("❌ Database configuration failed", error);

    throw new Error("Database configuration failed during startup.", {
      cause: error,
    });
  }

  logInfo("🔄 Preparing database startup", config.logConfig);

  try {
    await waitForDatabase();
  } catch (error) {
    logError("❌ Database readiness check failed", config.logConfig, error);

    throw new Error(
      `Database startup failed for ${config.host}:${config.port}/${config.database} (source: ${config.source}). If you are running outside Docker Compose, use localhost or set DATABASE_URL explicitly.`,
      { cause: error },
    );
  }

  try {
    await runStartupMigrations();
  } catch (error) {
    logError("❌ Database migrations failed", config.logConfig, error);

    throw new Error(
      `Database migrations failed for ${config.host}:${config.port}/${config.database} (source: ${config.source}).`,
      { cause: error },
    );
  }
}
