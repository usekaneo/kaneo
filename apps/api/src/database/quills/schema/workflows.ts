import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Workflows engine (support platform §4.6). One trigger + a JSONB graph of
 * condition/branch/action/wait nodes. `class` drives execution: customer_facing
 * runs are exclusive per conversation (first match by sortOrder wins, locked
 * while running); background runs go in parallel. `workflow_runs.cursor` + a
 * BullMQ delayed job per wait is the durable state machine; `workflow_run_events`
 * is the audit + per-person frequency-cap ledger. Per-workspace DB, no workspace
 * column.
 */
import {
  text,
  integer,
  jsonb,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import { conversations } from "./conversation";

/** customer_facing = exclusive per conversation; background = parallel. */
export type WorkflowClass = "customer_facing" | "background";
/** draft = editable/inert, live = dispatching, paused = retained but inert. */
export type WorkflowStatus = "draft" | "live" | "paused";
/** running -> waiting (durable) -> done, or interrupted by a reply/close. */
export type WorkflowRunState = "running" | "waiting" | "done" | "interrupted";

export const workflows = quillsSchema
  .table(
    "workflows",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("workflow")("id").notNull(),
      name: text("name").notNull(),
      class: text("class").$type<WorkflowClass>().notNull(),
      status: text("status").$type<WorkflowStatus>().notNull().default("draft"),
      // Drag order; customer_facing first-match resolves ties by it. ('order' is a
      // reserved word, so the column is sort_order.)
      sortOrder: integer("sort_order").notNull().default(0),
      triggerType: text("trigger_type").notNull(),
      triggerSettings: jsonb("trigger_settings")
        .$type<Record<string, unknown>>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      // The canvas: { nodes, edges }. Stored whole — the editor serializes it and no
      // query needs a single node cross-workflow. The app owns the shape.
      graph: jsonb("graph")
        .$type<Record<string, unknown>>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      createdBy: typeIdColumnNullable("principal")("created_by"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      foreignKey({
        name: "workflows_created_by_fkey",
        columns: [table.workspaceId, table.createdBy],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      index("workflows_trigger_status_order_idx").on(
        table.triggerType,
        table.status,
        table.sortOrder,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const workflowRuns = quillsSchema
  .table(
    "workflow_runs",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("workflow_run")("id").notNull(),
      workflowId: typeIdColumn("workflow")("workflow_id").notNull(),
      conversationId: typeIdColumnNullable("conversation")("conversation_id"),
      subjectPrincipalId: typeIdColumnNullable("principal")(
        "subject_principal_id",
      ),
      state: text("state")
        .$type<WorkflowRunState>()
        .notNull()
        .default("running"),
      // Denormalized from workflows.class at insert time (not read via a join) so
      // the exclusive-lock index below can enforce it on this row alone —
      // hasActiveCustomerFacingRun is a cheap read-only pre-check, not the lock
      // itself, and two triggers can both pass it before either inserts.
      customerFacing: boolean("customer_facing").notNull().default(false),
      cursor: jsonb("cursor")
        .$type<Record<string, unknown>>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      // The workflow's graph as of the moment this run started: a snapshot, not a
      // live reference. A run must finish walking the logic it began with even if
      // the workflow is edited while the run sits parked at a wait; re-reading the
      // live graph at resume would otherwise walk arbitrary new logic, or silently
      // settle the run done if the resume node was deleted.
      graph: jsonb("graph")
        .$type<Record<string, unknown>>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      startedAt: timestamp("started_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      endedAt: timestamp("ended_at", { withTimezone: true }),
    },
    (table) => [
      foreignKey({
        name: "workflow_runs_workflow_id_fkey",
        columns: [table.workspaceId, table.workflowId],
        foreignColumns: [workflows.workspaceId, workflows.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "workflow_runs_conversation_id_fkey",
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "workflow_runs_subject_principal_id_fkey",
        columns: [table.workspaceId, table.subjectPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      index("workflow_runs_conversation_state_idx")
        .on(table.conversationId, table.state)
        .where(sql`"conversation_id" IS NOT NULL`),
      index("workflow_runs_state_idx").on(table.state),
      // Per-workflow run listings and the retention compactor's per-workflow
      // scans; also the FK RI lookup on workflow deletion.
      index("workflow_runs_workflow_idx").on(table.workflowId),
      // workflowEffectiveness (workflow-reporting.ts) filters by a started_at
      // range with no other narrowing predicate; a plain btree serves it directly.
      index("workflow_runs_started_at_idx").on(table.startedAt),
      // The exclusive lock itself: at most one running/waiting customer_facing run
      // per conversation, enforced by Postgres. The pre-check in dispatcher.guards
      // can't close the TOCTOU gap on its own; this index is what actually does.
      uniqueIndex("workflow_runs_exclusive_customer_facing_idx")
        .on(table.workspaceId, table.conversationId)
        .where(sql`"state" IN ('running', 'waiting') AND "customer_facing"`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const workflowRunEvents = quillsSchema
  .table(
    "workflow_run_events",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("workflow_run_event")("id").notNull(),
      runId: typeIdColumn("workflow_run")("run_id").notNull(),
      workflowId: typeIdColumn("workflow")("workflow_id").notNull(),
      subjectPrincipalId: typeIdColumnNullable("principal")(
        "subject_principal_id",
      ),
      kind: text("kind").notNull(),
      at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
      foreignKey({
        name: "workflow_run_events_run_id_fkey",
        columns: [table.workspaceId, table.runId],
        foreignColumns: [workflowRuns.workspaceId, workflowRuns.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "workflow_run_events_workflow_id_fkey",
        columns: [table.workspaceId, table.workflowId],
        foreignColumns: [workflows.workspaceId, workflows.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "workflow_run_events_subject_principal_id_fkey",
        columns: [table.workspaceId, table.subjectPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      index("workflow_run_events_cap_idx").on(
        table.workflowId,
        table.subjectPrincipalId,
        table.at,
      ),
      // Run-detail timeline lookups and the FK RI lookup on run deletion
      // (retention compactor deletes runs in bulk).
      index("workflow_run_events_run_idx").on(table.runId),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * A saved snapshot of a workflow (support platform §4.6 version history +
 * rollback). One row per meaningful save: written on create and on every
 * update that actually changes name/triggerType/triggerSettings/graph — a
 * no-op save (e.g. touching only sortOrder) writes nothing. This is
 * intentionally NOT a full audit log: workflow.service.ts prunes each
 * workflow down to its newest 50 versions after every insert, so it is a
 * bounded "recent states this workflow has been saved in" list, not a
 * permanent ledger. `created_by` is who made the save that produced this
 * snapshot (null for a system-authored save or once the author is deleted).
 */
export const workflowVersions = quillsSchema
  .table(
    "workflow_versions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("workflow_version")("id").notNull(),
      workflowId: typeIdColumn("workflow")("workflow_id").notNull(),
      name: text("name").notNull(),
      triggerType: text("trigger_type").notNull(),
      triggerSettings: jsonb("trigger_settings")
        .$type<Record<string, unknown>>()
        .notNull(),
      graph: jsonb("graph").$type<Record<string, unknown>>().notNull(),
      createdBy: typeIdColumnNullable("principal")("created_by"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      foreignKey({
        name: "workflow_versions_workflow_id_fkey",
        columns: [table.workspaceId, table.workflowId],
        foreignColumns: [workflows.workspaceId, workflows.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "workflow_versions_created_by_fkey",
        columns: [table.workspaceId, table.createdBy],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      // The history sheet's hot read: a workflow's versions, newest first.
      index("workflow_versions_workflow_created_idx").on(
        table.workflowId,
        // Plain `DESC` in migration 0188 -> postgres default NULLS FIRST; declare
        // it so drizzle-kit does not read a NULLS LAST mismatch.
        table.createdAt.desc().nullsFirst(),
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type Workflow = typeof workflows.$inferSelect;
export type WorkflowRun = typeof workflowRuns.$inferSelect;
export type WorkflowRunEvent = typeof workflowRunEvents.$inferSelect;
export type WorkflowVersion = typeof workflowVersions.$inferSelect;
