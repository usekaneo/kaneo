import { Client } from "pg";

/** Administrative maintenance: partition DDL applies to all workspaces. */
export async function ensurePageViewPartitions(
  client: Client,
  daysAhead = 7,
): Promise<void> {
  if (!Number.isInteger(daysAhead) || daysAhead < 1 || daysAhead > 60)
    throw new Error("Invalid partition horizon");
  await client.query(`DO $$ DECLARE d date; BEGIN FOR i IN -1..${daysAhead} LOOP
    d := (now() AT TIME ZONE 'UTC')::date + i;
    EXECUTE format('CREATE TABLE IF NOT EXISTS quills.%I PARTITION OF quills.page_views FOR VALUES FROM (%L) TO (%L)', 'page_views_' || to_char(d, 'YYYYMMDD'), d::text || ' 00:00:00+00', (d + 1)::text || ' 00:00:00+00');
  END LOOP; END $$`);
}

/** Administrative global retention; never call this from a workspace request. */
export async function dropExpiredPageViewPartitions(
  client: Client,
  retentionDays = 90,
): Promise<string[]> {
  if (
    !Number.isInteger(retentionDays) ||
    retentionDays < 1 ||
    retentionDays > 3650
  )
    throw new Error("Invalid partition retention");
  const result = await client.query<{ relname: string }>(
    `SELECT c.relname FROM pg_inherits i JOIN pg_class c ON c.oid=i.inhrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE i.inhparent='quills.page_views'::regclass AND n.nspname='quills' AND c.relname ~ '^page_views_[0-9]{8}$' AND right(c.relname,8) < to_char((now() AT TIME ZONE 'UTC')::date - $1::int, 'YYYYMMDD')`,
    [retentionDays],
  );
  for (const { relname } of result.rows)
    await client.query(`DROP TABLE quills."${relname}"`);
  return result.rows.map((row) => row.relname);
}

/** One replica maintains the global partition window; migration uses the same lock. */
export async function maintainPageViewPartitions(
  connectionString: string,
): Promise<void> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    await client.query("SET lock_timeout = '30s'");
    await client.query("SET TIME ZONE 'UTC'");
    const lock = await client.query<{ acquired: boolean }>(
      "SELECT pg_try_advisory_lock(48203, hashtext(current_database())) AS acquired",
    );
    if (!lock.rows[0]?.acquired) return;
    await ensurePageViewPartitions(client);
    await dropExpiredPageViewPartitions(client);
  } finally {
    await client.end();
  }
}
