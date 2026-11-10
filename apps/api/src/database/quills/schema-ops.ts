import { is } from "drizzle-orm";
import { PgTable, getTableConfig } from "drizzle-orm/pg-core";
import * as schema from "./schema";
import type { Client } from "pg";
export interface ConcurrentIndexSpec {
  name: string;
  concurrent: boolean;
  ddl: string;
}
export const CONCURRENT_INDEX_SPECS: readonly ConcurrentIndexSpec[] = [
  {
    name: "principal_kaneo_user_id_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS principal_kaneo_user_id_lookup_idx ON quills.principal (kaneo_user_id) WHERE kaneo_user_id IS NOT NULL",
  },
  {
    name: "customer_identity_image_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS customer_identity_image_key_lookup_idx ON quills.customer_identity (image_key) WHERE image_key IS NOT NULL",
  },
  {
    name: "principal_avatar_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS principal_avatar_key_lookup_idx ON quills.principal (avatar_key) WHERE avatar_key IS NOT NULL",
  },
  {
    name: "settings_logo_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS settings_logo_key_lookup_idx ON quills.settings (logo_key) WHERE logo_key IS NOT NULL",
  },
  {
    name: "settings_favicon_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS settings_favicon_key_lookup_idx ON quills.settings (favicon_key) WHERE favicon_key IS NOT NULL",
  },
  {
    name: "settings_header_logo_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS settings_header_logo_key_lookup_idx ON quills.settings (header_logo_key) WHERE header_logo_key IS NOT NULL",
  },
  {
    name: "settings_portal_og_image_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS settings_portal_og_image_key_lookup_idx ON quills.settings (portal_og_image_key) WHERE portal_og_image_key IS NOT NULL",
  },
  {
    name: "files_storage_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS files_storage_key_lookup_idx ON quills.files (storage_key) WHERE storage_key IS NOT NULL",
  },
  {
    name: "assistant_documents_storage_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS assistant_documents_storage_key_lookup_idx ON quills.assistant_documents (storage_key) WHERE storage_key IS NOT NULL",
  },
  {
    name: "export_runs_s3_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS export_runs_s3_key_lookup_idx ON quills.export_runs (s3_key) WHERE s3_key IS NOT NULL",
  },
  {
    name: "files_thumb_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS files_thumb_key_lookup_idx ON quills.files ((meta->>'thumbKey'))",
  },
  {
    name: "files_rendition_key_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS files_rendition_key_lookup_idx ON quills.files ((meta->>'renditionKey'))",
  },
  {
    name: "conversation_messages_attachments_lookup_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_messages_attachments_lookup_idx ON quills.conversation_messages USING gin (attachments jsonb_path_ops)",
  },
  {
    name: "job_queue_workspace_claim_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS job_queue_workspace_claim_idx ON quills.job_queue (workspace_id, queue, run_at, id) WHERE status='pending'",
  },
  {
    name: "events_workspace_pending_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS events_workspace_pending_idx ON quills.events (workspace_id, id) WHERE published_at IS NULL",
  },
  {
    name: "email_log_workspace_retention_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS email_log_workspace_retention_idx ON quills.email_log (workspace_id, created_at)",
  },
  {
    name: "job_queue_workspace_terminal_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS job_queue_workspace_terminal_idx ON quills.job_queue (workspace_id, finished_at) WHERE status IN ('failed','succeeded')",
  },
  {
    name: "posts_embedding_hnsw_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS posts_embedding_hnsw_idx ON quills.posts USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL",
  },
  {
    name: "kb_articles_embedding_hnsw_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS kb_articles_embedding_hnsw_idx ON quills.kb_articles USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL",
  },
  {
    name: "assistant_snippets_embedding_hnsw_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS assistant_snippets_embedding_hnsw_idx ON quills.assistant_snippets USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL",
  },
  {
    name: "conversation_summaries_embedding_hnsw_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_summaries_embedding_hnsw_idx ON quills.conversation_summaries USING hnsw (embedding vector_cosine_ops) WHERE embedding IS NOT NULL",
  },
  {
    name: "principal_display_name_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS principal_display_name_trgm_idx ON quills.principal USING gin (display_name gin_trgm_ops) WHERE display_name IS NOT NULL",
  },
  {
    name: "conversation_messages_content_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS conversation_messages_content_trgm_idx ON quills.conversation_messages USING gin (content gin_trgm_ops) WHERE deleted_at IS NULL",
  },
  {
    // Search's close-spelling fallback on post titles (post.search.ts). posts
    // is a large table, so it is built here rather than in a migration.
    name: "posts_title_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS posts_title_trgm_idx ON quills.posts USING gin (title gin_trgm_ops) WHERE deleted_at IS NULL",
  },
  {
    name: "user_name_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS user_name_trgm_idx ON quills.customer_identity USING gin (name gin_trgm_ops)",
  },
  // Workspace search (ask-search.ts) reads every kind from an index: the text
  // the queries rank (each expression matches the query's, so the planner uses
  // it) and titles, emails, names and domains matched anywhere inside with
  // ILIKE '%query%'. user, conversations and tickets are large, so these are
  // built here rather than in a migration.
  {
    name: "tickets_title_search_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS tickets_title_search_idx ON quills.tickets USING gin (to_tsvector('english', title))",
  },
  {
    name: "conversations_subject_search_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_subject_search_idx ON quills.conversations USING gin (to_tsvector('english', coalesce(subject, '')))",
  },
  {
    name: "changelog_entries_search_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS changelog_entries_search_idx ON quills.changelog_entries USING gin (to_tsvector('english', coalesce(title, '') || ' ' || coalesce(content, '')))",
  },
  {
    name: "user_email_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS user_email_trgm_idx ON quills.customer_identity USING gin (email gin_trgm_ops)",
  },
  {
    name: "companies_name_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS companies_name_trgm_idx ON quills.companies USING gin (name gin_trgm_ops)",
  },
  {
    name: "companies_domain_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS companies_domain_trgm_idx ON quills.companies USING gin (domain gin_trgm_ops)",
  },
  {
    name: "kb_articles_title_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS kb_articles_title_trgm_idx ON quills.kb_articles USING gin (title gin_trgm_ops)",
  },
  {
    name: "changelog_entries_title_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS changelog_entries_title_trgm_idx ON quills.changelog_entries USING gin (title gin_trgm_ops)",
  },
  {
    name: "tickets_title_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS tickets_title_trgm_idx ON quills.tickets USING gin (title gin_trgm_ops)",
  },
  {
    name: "conversations_subject_trgm_idx",
    concurrent: true,
    ddl: "CREATE INDEX CONCURRENTLY IF NOT EXISTS conversations_subject_trgm_idx ON quills.conversations USING gin (subject gin_trgm_ops)",
  },
  {
    // page_views is range-partitioned (0137); Postgres rejects CREATE INDEX
    // CONCURRENTLY on a partitioned parent ("cannot create index on partitioned
    // table ... concurrently"). Built non-concurrently on the parent, matching
    // how 0137 creates the table's other parent indexes; the index recurses to
    // existing partitions.
    name: "page_views_principal_id_idx",
    concurrent: false,
    ddl: "CREATE INDEX IF NOT EXISTS page_views_principal_id_idx ON quills.page_views (principal_id) WHERE principal_id IS NOT NULL",
  },
];

export async function ensureQuillsIndexes(
  client: Client,
  specs: readonly ConcurrentIndexSpec[] = CONCURRENT_INDEX_SPECS,
) {
  for (const spec of specs) {
    const state = await client.query<{ valid: boolean }>(
      `SELECT i.indisvalid AS valid FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='quills' AND c.relname=$1`,
      [spec.name],
    );
    if (state.rows[0]?.valid === false)
      await client.query(
        `DROP INDEX ${spec.concurrent ? "CONCURRENTLY" : ""} quills."${spec.name}"`,
      );
    await client.query(spec.ddl);
  }
}

export async function verifyQuillsPostconditions(client: Client) {
  const marker = await client.query(
    "SELECT to_regclass('quills_migrations.schema_manifest') AS name",
  );
  if (marker.rows[0].name) {
    const match = await client.query(
      "SELECT definition=quills_migrations.current_schema_manifest() AS matches FROM quills_migrations.schema_manifest WHERE id=true",
    );
    if (match.rows[0]?.matches !== true)
      throw new Error(
        "Quills restored schema differs from its migration manifest",
      );
  }
  for (const table of Object.values(schema).filter((value) =>
    is(value, PgTable),
  )) {
    const expected = getTableConfig(table);
    const actual = await client.query<{ attname: string }>(
      `SELECT a.attname FROM pg_attribute a JOIN pg_class c ON c.oid=a.attrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='quills' AND c.relname=$1 AND a.attnum>0 AND NOT a.attisdropped`,
      [expected.name],
    );
    const columns = new Set(actual.rows.map((row) => row.attname));
    if (expected.columns.some((column) => !columns.has(column.name)))
      throw new Error(`Quills table or column missing: ${expected.name}`);
    const constraints = await client.query<{ conname: string }>(
      `SELECT co.conname FROM pg_constraint co JOIN pg_class c ON c.oid=co.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='quills' AND c.relname=$1`,
      [expected.name],
    );
    const names = new Set(constraints.rows.map((row) => row.conname));
    if (
      expected.foreignKeys.some((key) => !names.has(key.getName().slice(0, 63)))
    )
      throw new Error(`Quills foreign key missing: ${expected.name}`);
  }

  const invalid = await client.query(
    `SELECT c.relname FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='quills' AND NOT i.indisvalid`,
  );
  if (invalid.rowCount) throw new Error("Quills contains invalid indexes");
  const unsafe = await client.query(
    `SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='quills' AND c.relkind IN ('r','p') AND NOT c.relispartition AND (NOT c.relrowsecurity OR NOT c.relforcerowsecurity OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid=c.oid AND p.polname='workspace_isolation'))`,
  );
  if (unsafe.rowCount)
    throw new Error("Quills workspace isolation is incomplete");
  for (const spec of CONCURRENT_INDEX_SPECS) {
    const actual = await client.query<{ definition: string }>(
      `SELECT pg_get_indexdef(c.oid) AS definition FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_index i ON i.indexrelid=c.oid WHERE n.nspname='quills' AND c.relname=$1 AND i.indisvalid`,
      [spec.name],
    );
    if (!actual.rows[0]) throw new Error(`Missing Quills index: ${spec.name}`);
    // Let PostgreSQL normalize expressions and predicates on an empty temporary table.
    const table = / ON quills\.([a-z_]+)/.exec(spec.ddl)?.[1];
    if (!table)
      throw new Error(`Invalid operational index specification: ${spec.name}`);
    await client.query(
      `CREATE TEMP TABLE quills_index_probe (LIKE quills.${table})`,
    );
    try {
      await client.query(
        spec.ddl
          .replace("CONCURRENTLY ", "")
          .replace("IF NOT EXISTS ", "")
          .replace(spec.name, "quills_index_probe_idx")
          .replace(`ON quills.${table}`, "ON quills_index_probe"),
      );
      const expected = await client.query<{ definition: string }>(
        "SELECT pg_get_indexdef('pg_temp.quills_index_probe_idx'::regclass) AS definition",
      );
      const suffix = (definition: string) =>
        definition.slice(definition.indexOf(" USING "));
      if (
        suffix(actual.rows[0].definition) !==
        suffix(expected.rows[0]!.definition)
      )
        throw new Error(`Quills index definition differs: ${spec.name}`);
    } finally {
      await client.query("DROP TABLE quills_index_probe");
    }
  }
}
