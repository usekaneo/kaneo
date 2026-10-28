import { sql } from "drizzle-orm";
import { safeErrorCode } from "./safe-error-code";
import type { ServiceStatus } from "./service-status";
import { withDatabaseTimeout } from "./with-database-timeout";

type DatabaseProbe = {
  status: ServiceStatus;
  serverVersion: string | null;
  latencyMs: number | null;
  migrationsApplied: number | null;
  errorCode: string | null;
};

export async function probeDatabase(timeoutMs: number): Promise<DatabaseProbe> {
  const started = performance.now();
  try {
    return await withDatabaseTimeout(async (tx, signal) => {
      const result = await tx.execute<{ version: string }>(
        sql`select current_setting('server_version') as version`,
      );
      const latencyMs = Math.round(performance.now() - started);
      signal.throwIfAborted();
      let migrationsApplied: number | null = null;
      try {
        const migrations = await tx.execute<{ applied: number }>(
          sql`select count(*)::int as applied from drizzle.__drizzle_migrations`,
        );
        migrationsApplied = migrations.rows[0]?.applied ?? null;
      } catch {
        // Migration metadata is optional; connectivity was already checked.
      }
      return {
        status: "ok",
        serverVersion: result.rows[0]?.version ?? null,
        latencyMs,
        migrationsApplied,
        errorCode: null,
      };
    }, timeoutMs);
  } catch (error) {
    return {
      status: "down",
      serverVersion: null,
      latencyMs: null,
      migrationsApplied: null,
      errorCode: safeErrorCode(error),
    };
  }
}
