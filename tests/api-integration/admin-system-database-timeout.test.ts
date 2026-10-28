import { sql } from "drizzle-orm";
import { describe, expect, it, vi } from "vite-plus/test";
import db, { getDatabasePool } from "../../apps/api/src/database";
import { listIntegrationProviders } from "../../apps/api/src/admin/system/list-integration-providers";
import { probeDatabase } from "../../apps/api/src/admin/system/probe-database";
import { ensureTestDatabaseMigrated } from "./helpers/database";

describe("system database probe timeout", () => {
  it("stops timed-out status and integration queries on PostgreSQL", async () => {
    await ensureTestDatabaseMigrated();
    const blocker = await getDatabasePool().connect();
    try {
      await blocker.query("begin");
      await blocker.query(
        "lock table drizzle.__drizzle_migrations, integration in access exclusive mode",
      );

      await Promise.all([probeDatabase(100), listIntegrationProviders(100)]);

      await vi.waitFor(
        async () => {
          const result = await db.execute<{ active: number }>(sql`
          select count(*)::int as active from pg_stat_activity
          where datname = current_database()
            and state = 'active' and pid <> pg_backend_pid()
            and query ilike 'select%count(%'
            and (query like '%__drizzle_migrations%' or query like '%"integration"%')
        `);
          expect(result.rows[0]?.active).toBe(0);
        },
        { timeout: 1000 },
      );
    } finally {
      await blocker.query("rollback");
      blocker.release();
    }
  });
});
