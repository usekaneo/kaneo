import { is, sql } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import { z } from "zod";
import type { Database } from "../../database/quills/client";
import * as schema from "../../database/quills/schema";

export const MAX_ARCHIVE_BYTES = 64 * 1024 * 1024;
export const OMITTED_TABLES = [
  "events",
  "job_queue",
  "hook_deliveries",
  "kv_store",
  "kv_set_member",
  "presence_stream",
  "rate_bucket",
  "realtime_overflow",
  "widget_origin_session",
  "widget_identified_session",
  "api_keys",
  "push_devices",
  "import_runs",
  "export_runs",
  "onboarding_emails",
] as const;
export const portableTables = Object.values(schema)
  .filter((value) => is(value, PgTable))
  .map((table) => ({ table, config: getTableConfig(table) }))
  .filter(
    ({ config }) =>
      !(OMITTED_TABLES as readonly string[]).includes(config.name),
  );
export const archiveSchema = z
  .object({
    format: z.literal("quills-workspace"),
    version: z.literal(1),
    origin: z.enum(["kaneo", "quackback"]),
    createdAt: z.iso.datetime(),
    sourceWorkspaceId: z.string().optional(),
    tables: z.record(z.string(), z.array(z.record(z.string(), z.json()))),
    storageKeys: z.array(z.string().min(1)),
    omittedTables: z.array(z.string()),
  })
  .strict();
export type WorkspaceArchive = z.infer<typeof archiveSchema>;
export const quote = (name: string) => '"' + name.replaceAll('"', '""') + '"';

/** Reject over-budget tables in PostgreSQL before transferring row payloads. */
export function boundedArchiveQuery(select: string, remaining: number) {
  if (!Number.isSafeInteger(remaining) || remaining < 0)
    throw new Error("Invalid archive budget");
  return `WITH archive_rows AS MATERIALIZED (${select}) SELECT CASE WHEN sum(octet_length(row::text)+1) OVER () <= ${remaining} THEN row ELSE NULL END AS row FROM archive_rows`;
}

export async function exportWorkspaceArchive(
  db: Database,
  workspaceId: string,
): Promise<WorkspaceArchive> {
  const tables: WorkspaceArchive["tables"] = {};
  let size = 0;
  // shortcut: archives are bounded in memory; use a streaming format above 64 MiB.
  for (const { config } of portableTables) {
    const bigints = config.columns.filter((c) =>
      ["bigint", "bigserial"].includes(c.getSQLType()),
    );
    const extra = bigints.length
      ? ` || jsonb_build_object(${bigints.flatMap((c) => ["'" + c.name + "'", `t.${quote(c.name)}::text`]).join(",")})`
      : "";
    const result = await db.execute<{
      row: WorkspaceArchive["tables"][string][number] | null;
    }>(
      sql.raw(
        boundedArchiveQuery(
          `SELECT to_jsonb(t)${extra} AS row FROM ${quote(config.schema!)}.${quote(config.name)} t LIMIT 100001`,
          MAX_ARCHIVE_BYTES - size,
        ),
      ),
    );
    if (result.rows.length > 100000)
      throw new Error(`Archive row limit exceeded for ${config.name}`);
    if (result.rows.some((r) => r.row === null))
      throw new Error("Workspace archive exceeds 64 MiB");
    const rows = result.rows.map((r) => r.row!);
    size += Buffer.byteLength(JSON.stringify(rows));
    if (size > MAX_ARCHIVE_BYTES)
      throw new Error("Workspace archive exceeds 64 MiB");
    tables[config.name] = rows;
  }

  const archive: WorkspaceArchive = {
    format: "quills-workspace",
    version: 1,
    origin: "kaneo",
    createdAt: new Date().toISOString(),
    sourceWorkspaceId: workspaceId,
    tables,
    storageKeys: collectStorageKeys(tables),
    omittedTables: [...OMITTED_TABLES],
  };
  if (Buffer.byteLength(JSON.stringify(archive)) > MAX_ARCHIVE_BYTES)
    throw new Error("Workspace archive exceeds 64 MiB");
  return archive;
}

export const STORAGE_FIELDS: Record<string, string[]> = {
  settings: [
    "logo_key",
    "favicon_key",
    "header_logo_key",
    "portal_og_image_key",
  ],
  customer_identity: ["image_key"],
  principal: ["avatar_key"],
  files: ["storage_key"],
  assistant_documents: ["storage_key"],
};
export function storageValues(
  row: WorkspaceArchive["tables"][string][number],
  name: string,
) {
  const values: { object: Record<string, unknown>; field: string }[] = (
    STORAGE_FIELDS[name] ?? []
  ).map((field) => ({ object: row, field }));
  const previews =
    name === "files"
      ? [row.meta]
      : name === "conversation_messages" && Array.isArray(row.attachments)
        ? row.attachments.map((a) =>
            a && typeof a === "object" && !Array.isArray(a) ? a.preview : null,
          )
        : [];
  for (const preview of previews)
    if (preview && typeof preview === "object" && !Array.isArray(preview))
      for (const field of ["thumbKey", "renditionKey"])
        values.push({ object: preview, field });
  return values;
}
export function collectStorageKeys(tables: WorkspaceArchive["tables"]) {
  const keys = new Set<string>();
  for (const [name, rows] of Object.entries(tables))
    for (const row of rows)
      for (const { object, field } of storageValues(row, name))
        if (typeof object[field] === "string" && object[field])
          keys.add(object[field]);
  return [...keys];
}
