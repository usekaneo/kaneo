import { sql } from "drizzle-orm";
import db from "../../database";
import { safeErrorCode } from "./safe-error-code";
import type { ServiceStatus } from "./service-status";
import { withTimeout } from "./with-timeout";

type DatabaseProbe = {
  status: ServiceStatus;
  serverVersion: string | null;
  latencyMs: number | null;
  migrationsApplied: number | null;
  errorCode: string | null;
};

async function countAppliedMigrations(timeoutMs: number) {
  try {
    const result = await withTimeout(
      () =>
        db.execute<{ applied: number }>(
          sql`select count(*)::int as applied from drizzle.__drizzle_migrations`,
        ),
      timeoutMs,
    );
    return result.rows[0]?.applied ?? null;
  } catch {
    return null;
  }
}

export async function probeDatabase(timeoutMs: number): Promise<DatabaseProbe> {
  const started = performance.now();
  try {
    const result = await withTimeout(
      () =>
        db.execute<{ version: string }>(
          sql`select current_setting('server_version') as version`,
        ),
      timeoutMs,
    );
    const latencyMs = Math.round(performance.now() - started);
    return {
      status: "ok",
      serverVersion: result.rows[0]?.version ?? null,
      latencyMs,
      migrationsApplied: await countAppliedMigrations(timeoutMs),
      errorCode: null,
    };
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
