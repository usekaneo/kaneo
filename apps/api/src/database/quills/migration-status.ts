import { readMigrationFiles } from "drizzle-orm/migrator";
import type { Client } from "pg";
export async function getMigrationStatus(
  client: Client,
  migrationsFolder: string,
) {
  const bundled = readMigrationFiles({ migrationsFolder });
  const result = await client.query<{ hash: string; created_at: string }>(
    "SELECT hash, created_at FROM quills_migrations.__drizzle_migrations",
  );
  const applied = new Map(
    result.rows.map((row) => [Number(row.created_at), row.hash]),
  );
  return {
    upToDate:
      applied.size === bundled.length &&
      bundled.every((entry) => applied.get(entry.folderMillis) === entry.hash),
    bundledCount: bundled.length,
    appliedCount: result.rowCount ?? 0,
  };
}
