import { setTimeout as delay } from "node:timers/promises";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { getMigrationStatus } from "./migration-status";
import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { sql } from "drizzle-orm";
import * as schema from "./schema";
import { CATALOGUE_VERSION } from "./seed-system";
import { initializeQuillsWorkspace } from "./initialize-workspace";
import type { Database } from "./client";
import { ensurePageViewPartitions } from "./page-view-partitions";
import {
  CONCURRENT_INDEX_SPECS,
  ensureQuillsIndexes,
  verifyQuillsPostconditions,
} from "./schema-ops";

export async function runQuillsMigrations(
  connectionString: string,
  migrationsFolder: string,
  applicationRole?: string,
): Promise<void> {
  const host = new URL(connectionString).hostname;
  if (host.includes("-pooler.") || host.endsWith("-pooler"))
    throw new Error("Quills migrations require a direct PostgreSQL connection");
  const client = new Client({
    connectionString,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();
  try {
    await client.query("SET lock_timeout = '30s'");
    await client.query("SET TIME ZONE 'UTC'");
    // A blocking SELECT holds a snapshot that can deadlock concurrent index builds.
    const lockDeadline = Date.now() + 30000;
    while (
      !(
        await client.query(
          "SELECT pg_try_advisory_lock(48203, hashtext(current_database())) AS locked",
        )
      ).rows[0].locked
    ) {
      if (Date.now() >= lockDeadline)
        throw new Error("Timed out waiting for Quills migration lock");
      await delay(100);
    }
    const version = await client.query("SHOW server_version_num");
    if (Number(version.rows[0].server_version_num) < 150000)
      throw new Error("Quills requires PostgreSQL 15 or later");
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    await client.query("CREATE EXTENSION IF NOT EXISTS pg_trgm");
    const extension = await client.query(
      "SELECT extversion FROM pg_extension WHERE extname='vector'",
    );
    const vectorVersion = /^(\d+)\.(\d+)\.(\d+)/.exec(
      extension.rows[0]?.extversion ?? "",
    );
    if (
      !vectorVersion ||
      (Number(vectorVersion[1]) === 0 && Number(vectorVersion[2]) < 5)
    )
      throw new Error(
        "Quills requires pgvector 0.5.0 or later with HNSW support",
      );
    const hnsw = await client.query("SELECT 1 FROM pg_am WHERE amname='hnsw'");
    if (!hnsw.rowCount)
      throw new Error("Quills requires the HNSW index access method");
    let appliedCount = 0;
    const ledger = await client.query(
      "SELECT to_regclass('quills_migrations.__drizzle_migrations') AS name",
    );
    if (ledger.rows[0].name) {
      const applied = await client.query<{ hash: string; created_at: string }>(
        "SELECT hash,created_at FROM quills_migrations.__drizzle_migrations",
      );
      appliedCount = applied.rows.length;
      const hashes = new Map(
        applied.rows.map((row) => [Number(row.created_at), row.hash]),
      );
      const bundled = readMigrationFiles({ migrationsFolder });
      if (
        applied.rows.length > bundled.length ||
        applied.rows.some(
          (row) =>
            !bundled.some(
              (file) => file.folderMillis === Number(row.created_at),
            ),
        )
      )
        throw new Error(
          "Quills database contains migrations unknown to this application",
        );
      if (
        bundled
          .slice(0, applied.rows.length)
          .some((file) => !hashes.has(file.folderMillis))
      )
        throw new Error("Quills migration history is not a contiguous prefix");
      for (const file of bundled)
        if (
          hashes.has(file.folderMillis) &&
          hashes.get(file.folderMillis) !== file.hash
        )
          throw new Error("An applied Quills migration was changed");
    }
    const manifest = await client.query(
      "SELECT to_regclass('quills_migrations.schema_manifest') AS name",
    );
    if (manifest.rows[0].name) {
      const saved = await client.query<{
        tables: Record<string, { indexes: Record<string, string> | null }>;
      }>(
        "SELECT definition->'tables' AS tables FROM quills_migrations.schema_manifest WHERE id=true",
      );
      const recordedIndexes = new Set(
        Object.values(saved.rows[0]?.tables ?? {}).flatMap((table) =>
          Object.keys(table.indexes ?? {}),
        ),
      );
      // Recover interrupted operational rebuilds before comparison, without adding indexes from pending migrations.
      await ensureQuillsIndexes(
        client,
        CONCURRENT_INDEX_SPECS.filter((spec) => recordedIndexes.has(spec.name)),
      );
      const match = await client.query(
        "SELECT definition=quills_migrations.current_schema_manifest() AS matches FROM quills_migrations.schema_manifest WHERE id=true",
      );
      if (match.rows[0]?.matches !== true)
        throw new Error(
          "Quills restored schema differs from its migration manifest",
        );
    }
    await migrate(drizzle(client), {
      migrationsFolder,
      migrationsSchema: "quills_migrations",
      migrationsTable: "__drizzle_migrations",
    });
    await client.query(
      `DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname='quills_runtime') THEN CREATE ROLE quills_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS; END IF; END $$`,
    );
    const role = await client.query(
      "SELECT rolsuper, rolbypassrls, rolcanlogin, rolcreaterole, rolcreatedb, oid FROM pg_roles WHERE rolname='quills_runtime'",
    );
    if (
      role.rows[0].rolsuper ||
      role.rows[0].rolbypassrls ||
      role.rows[0].rolcanlogin ||
      role.rows[0].rolcreaterole ||
      role.rows[0].rolcreatedb
    )
      throw new Error("Unsafe quills_runtime database role");
    if (
      (
        await client.query("SELECT 1 FROM pg_auth_members WHERE member=$1", [
          role.rows[0].oid,
        ])
      ).rowCount
    )
      throw new Error("quills_runtime must not inherit another database role");
    const grantee = applicationRole
      ? `"${applicationRole.replaceAll('"', '""')}"`
      : "CURRENT_USER";
    await client.query(`GRANT quills_runtime TO ${grantee}`);
    if (applicationRole)
      await client.query("GRANT quills_runtime TO CURRENT_USER");
    await client.query(`GRANT USAGE ON SCHEMA quills TO ${grantee}`);
    await client.query(
      `GRANT EXECUTE ON FUNCTION quills.storage_references(), quills.storage_keys_for_workspace(text), quills.storage_object_is_referenced(text), quills.runnable_workspaces(text) TO ${grantee}`,
    );
    await client.query("GRANT USAGE ON SCHEMA quills TO quills_runtime");
    await client.query(
      "GRANT EXECUTE ON FUNCTION quills.prepare_import_partitions(date[]),quills.advance_imported_sequences() TO quills_runtime",
    );
    await client.query(
      `DO $$ DECLARE t record; BEGIN FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='quills' AND c.relkind IN ('r','p') AND NOT c.relispartition LOOP EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE quills.%I TO quills_runtime', t.relname); END LOOP; END $$`,
    );
    await client.query(
      "GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA quills TO quills_runtime",
    );
    await client.query(
      "REVOKE UPDATE, DELETE ON quills.audit_log FROM quills_runtime",
    );
    await ensurePageViewPartitions(client);
    await ensureQuillsIndexes(client);
    if (appliedCount < readMigrationFiles({ migrationsFolder }).length)
      await client.query("SELECT quills_migrations.capture_schema_manifest()");
    await verifyQuillsPostconditions(client);
    if (!(await getMigrationStatus(client, migrationsFolder)).upToDate)
      throw new Error("Quills migration ledger does not match the bundled SQL");
    const workspaces = await client.query<{ id: string }>(
      "SELECT w.id FROM public.workspace w LEFT JOIN quills.settings s ON s.workspace_id=w.id WHERE w.archived_at IS NULL AND (s.catalogue_version IS NULL OR s.catalogue_version<>$1)",
      [CATALOGUE_VERSION],
    );
    for (const { id } of workspaces.rows)
      await drizzle(client, { schema }).transaction(async (tx) => {
        const active = await tx.execute<{ name: string; slug: string }>(
          sql`SELECT name,slug FROM public.workspace WHERE id=${id} AND archived_at IS NULL FOR SHARE`,
        );
        if (!active.rows.length) return;
        await tx.execute(
          sql`select set_config('quills.workspace_id', ${id}, true)`,
        );
        await tx.execute(sql`SET LOCAL ROLE quills_runtime`);
        await initializeQuillsWorkspace(tx as Database, {
          workspaceId: id,
          ...active.rows[0]!,
        });
      });
  } finally {
    await client.end();
  }
}
