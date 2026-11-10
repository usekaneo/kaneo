import { Client } from "pg";
import {
  boundedArchiveQuery,
  portableTables,
  quote,
  collectStorageKeys,
  MAX_ARCHIVE_BYTES,
  OMITTED_TABLES,
  type WorkspaceArchive,
} from "./archive";

/** Read-only extraction from the original single-workspace Quackback database. */
export async function exportLegacyArchive(
  connectionString: string,
): Promise<WorkspaceArchive> {
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    await client.query("BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY");
    await client.query("SET LOCAL statement_timeout='60s'");
    const available = await client.query<{
      table_name: string;
      column_name: string;
      data_type: string;
    }>(
      "SELECT table_name,column_name,data_type FROM information_schema.columns WHERE table_schema='public'",
    );
    if (
      !available.rows.some((c) => c.table_name === "principal") ||
      !available.rows.some((c) => c.table_name === "settings")
    )
      throw new Error("Source is not a Quackback database");
    const tables: WorkspaceArchive["tables"] = {};
    let size = 0;
    for (const { config } of portableTables) {
      const source = config.name === "customer_identity" ? "user" : config.name;
      const columns = available.rows.filter(
        (c) =>
          c.table_name === source &&
          config.columns.some((t) => t.name === c.column_name) &&
          c.column_name !== "workspace_id" &&
          c.column_name !== "kaneo_user_id",
      );
      if (!columns.length) continue;
      const select = columns
        .map(
          (c) =>
            `${quote(c.column_name)}${c.data_type === "bigint" ? "::text" : ""} AS ${quote(c.column_name)}`,
        )
        .join(",");
      const rows = (
        await client.query(
          boundedArchiveQuery(
            `SELECT to_jsonb(t) AS row FROM (SELECT ${select} FROM public.${quote(source)} LIMIT 100001) t`,
            MAX_ARCHIVE_BYTES - size,
          ),
        )
      ).rows.map((r) => r.row);
      if (rows.some((row) => row === null))
        throw new Error("Workspace archive exceeds 64 MiB");
      if (rows.length > 100000)
        throw new Error(`Archive row limit exceeded for ${source}`);
      size += Buffer.byteLength(JSON.stringify(rows));
      if (size > MAX_ARCHIVE_BYTES)
        throw new Error("Workspace archive exceeds 64 MiB");
      tables[config.name] = rows;
    }
    await client.query("COMMIT");
    const archive: WorkspaceArchive = {
      format: "quills-workspace",
      version: 1,
      origin: "quackback",
      createdAt: new Date().toISOString(),
      tables,
      storageKeys: collectStorageKeys(tables),
      omittedTables: [...OMITTED_TABLES],
    };
    if (Buffer.byteLength(JSON.stringify(archive)) > MAX_ARCHIVE_BYTES)
      throw new Error("Workspace archive exceeds 64 MiB");
    return archive;
  } finally {
    await client.end();
  }
}
