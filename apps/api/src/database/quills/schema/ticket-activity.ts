import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
import { text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { tickets } from "./tickets";
import { principal } from "./auth";

/**
 * Ticket activity log — tracks all meaningful state changes on tickets
 * (mirrors post_activity, the posts-side log).
 *
 * Each row represents a single activity event: status change, assignment,
 * priority change, reopen, etc. The principal_id records who performed the
 * action (null for system-initiated actions). Type-specific details are
 * stored in the metadata JSONB column.
 */
export const ticketActivity = quillsSchema
  .table(
    "ticket_activity",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("ticket_activity")("id").notNull(),
      ticketId: typeIdColumn("ticket")("ticket_id").notNull(),
      principalId: typeIdColumnNullable("principal")("principal_id"),
      type: text("type").notNull(),
      metadata: jsonb("metadata").notNull().default({}),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      index("ticket_activity_ticket_id_created_idx").on(
        t.ticketId,
        t.createdAt,
      ),
      index("ticket_activity_type_idx").on(t.type),
      primaryKey({ columns: [t.workspaceId, t.id] }),
      foreignKey({
        columns: [t.workspaceId, t.ticketId],
        foreignColumns: [tickets.workspaceId, tickets.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.workspaceId, t.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();

export const ticketActivityRelations = relations(ticketActivity, ({ one }) => ({
  ticket: one(tickets, {
    fields: [ticketActivity.workspaceId, ticketActivity.ticketId],
    references: [tickets.workspaceId, tickets.id],
    relationName: "ticketActivity",
  }),
  actor: one(principal, {
    fields: [ticketActivity.workspaceId, ticketActivity.principalId],
    references: [principal.workspaceId, principal.id],
    relationName: "ticketActivityActor",
  }),
}));
