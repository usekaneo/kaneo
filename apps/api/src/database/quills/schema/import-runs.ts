import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Import runs (Imports & exports hub, §I1).
 *
 * One row per async import job: a CSV (or a detected UserVoice/Canny export,
 * or the legacy REST path) submitted through the wizard. The worker owns the
 * pending -> dry_run|running -> completed|failed transition and writes back
 * totals + a capped error report the hub polls and renders.
 */
import { text, timestamp, jsonb, index, foreignKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import { postTags } from "./boards";

export type ImportRunSource = "csv" | "uservoice" | "canny" | "api";
export type ImportRunStatus =
  | "pending"
  | "dry_run"
  | "running"
  | "completed"
  | "failed";

export interface ImportRunTotals {
  rows: number;
  created: number;
  updated: number;
  skipped: number;
  errors: number;
}

export interface ImportRunErrorEntry {
  row: number;
  message: string;
  field?: string;
}

export const importRuns = quillsSchema
  .table(
    "import_runs",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("import_run")("id").notNull(),
      source: text("source", { enum: ["csv", "uservoice", "canny", "api"] })
        .$type<ImportRunSource>()
        .notNull(),
      fileName: text("file_name").notNull(),
      initiatedByPrincipalId: typeIdColumn("principal")(
        "initiated_by_principal_id",
      ).notNull(),
      status: text("status", {
        enum: ["pending", "dry_run", "running", "completed", "failed"],
      })
        .$type<ImportRunStatus>()
        .notNull()
        .default("pending"),
      totals: jsonb("totals").$type<ImportRunTotals>(),
      // Capped list of per-row errors (see MAX_ERRORS in the import service).
      errorReport: jsonb("error_report").$type<ImportRunErrorEntry[]>(),
      // The auto-tag ("import-{source}-{date}") created at run start and applied
      // to every post the run creates. Set null on tag delete — history keeps
      // the run row even once its tag is gone.
      batchTagId: typeIdColumnNullable("post_tag")("batch_tag_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      finishedAt: timestamp("finished_at", { withTimezone: true }),
    },
    (table) => [
      foreignKey({
        name: "import_runs_initiated_by_principal_id_fkey",
        columns: [table.workspaceId, table.initiatedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("restrict"),
      foreignKey({
        name: "import_runs_batch_tag_id_fkey",
        columns: [table.workspaceId, table.batchTagId],
        foreignColumns: [postTags.workspaceId, postTags.id],
      }).onDelete("set null"),
      index("import_runs_status_idx").on(table.status),
      index("import_runs_created_at_idx").on(table.createdAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const importRunsRelations = relations(importRuns, ({ one }) => ({
  initiatedBy: one(principal, {
    fields: [importRuns.workspaceId, importRuns.initiatedByPrincipalId],
    references: [principal.workspaceId, principal.id],
  }),
  batchTag: one(postTags, {
    fields: [importRuns.workspaceId, importRuns.batchTagId],
    references: [postTags.workspaceId, postTags.id],
  }),
}));
