import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Export runs (Imports & exports hub — workspace data export).
 *
 * One row per async workspace export job: an admin clicks "Export workspace
 * data", the worker zips every core entity (CSV/JSONL + manifest) into S3,
 * and the hub polls this row for status, size, and per-entity counts.
 * Mirrors import_runs, minus the source/batch-tag baggage.
 */
import {
  text,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

export type ExportRunStatus = "pending" | "running" | "completed" | "failed";

/** Per-entity row counts written into the zip manifest, e.g. { posts: 1204 }. */
export type ExportRunEntityCounts = Record<string, number>;

export const exportRuns = quillsSchema
  .table(
    "export_runs",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("export_run")("id").notNull(),
      status: text("status", {
        enum: ["pending", "running", "completed", "failed"],
      })
        .$type<ExportRunStatus>()
        .notNull()
        .default("pending"),
      // Download name presented to the admin (quackback-export-<slug>-<date>.zip).
      fileName: text("file_name").notNull(),
      // Bucket object key (exports/<runId>.zip). Null until the upload lands.
      s3Key: text("s3_key"),
      // Compressed zip size. integer is plenty: 2GB compressed ≈ 20GB of text.
      sizeBytes: integer("size_bytes"),
      entityCounts: jsonb("entity_counts").$type<ExportRunEntityCounts>(),
      // Failure reason surfaced in the hub history when status='failed'.
      error: text("error"),
      initiatedByPrincipalId: typeIdColumn("principal")(
        "initiated_by_principal_id",
      ).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      finishedAt: timestamp("finished_at", { withTimezone: true }),
      // Download cut-off (finished_at + retention). Enforced at download time;
      // the worker deletes the row + object once past this.
      expiresAt: timestamp("expires_at", { withTimezone: true }),
    },
    (table) => [
      foreignKey({
        name: "export_runs_initiated_by_principal_id_fkey",
        columns: [table.workspaceId, table.initiatedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("restrict"),
      index("export_runs_status_idx").on(table.status),
      index("export_runs_created_at_idx").on(table.createdAt),
      // At most one active (pending/running) run per deployment: a second
      // concurrent insert conflicts here and the route maps it to 409.
      uniqueIndex("export_runs_active_idx")
        .on(table.workspaceId, sql`(1)`)
        .where(sql`"status" IN ('pending', 'running')`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const exportRunsRelations = relations(exportRuns, ({ one }) => ({
  initiatedBy: one(principal, {
    fields: [exportRuns.workspaceId, exportRuns.initiatedByPrincipalId],
    references: [principal.workspaceId, principal.id],
  }),
}));
