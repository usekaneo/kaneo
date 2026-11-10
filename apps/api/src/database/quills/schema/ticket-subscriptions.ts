import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
import {
  timestamp,
  index,
  uniqueIndex,
  varchar,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { tickets } from "./tickets";
import { principal } from "./auth";

/**
 * Ticket subscriptions ("watchers") - per-ticket watch/unwatch with a
 * temporary mute, mirroring post_subscriptions.
 *
 * One row per (ticket, principal). Unsubscribe deletes the row; a new
 * qualifying interaction (assignment, reply) re-subscribes. Mute is a
 * timestamp: muted_until > now() suppresses watcher notifications, NULL or a
 * past value means active. Per-type/channel preferences stay in the global
 * notification matrix; this table only answers "who follows this ticket".
 */
export type TicketSubscriptionReason =
  | "requester"
  | "assignee"
  | "replier"
  | "manual";

export const ticketSubscriptions = quillsSchema
  .table(
    "ticket_subscriptions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("ticket_sub")("id").notNull(),
      ticketId: typeIdColumn("ticket")("ticket_id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      // Provenance: 'requester' | 'assignee' | 'replier' | 'manual'. The first
      // subscribe wins (onConflictDoNothing); unwatch-then-resubscribe refreshes it.
      reason: varchar("reason", { length: 20 }).notNull(),
      // Temporary mute: active while in the future; NULL = not muted.
      mutedUntil: timestamp("muted_until", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
    },
    (table) => [
      // Constraint names declared explicitly to match the hand-written migration
      // (0208), which uses the _fkey suffix rather than drizzle's generated name.
      foreignKey({
        name: "ticket_subscriptions_ticket_id_fkey",
        columns: [table.workspaceId, table.ticketId],
        foreignColumns: [tickets.workspaceId, tickets.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "ticket_subscriptions_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      // One subscription per principal per ticket.
      uniqueIndex("ticket_subscriptions_unique").on(
        table.workspaceId,
        table.ticketId,
        table.principalId,
      ),
      // Fan-out lookup: "who watches this ticket".
      index("ticket_subscriptions_ticket_idx").on(table.ticketId),
      // "My watches" + FK referential-integrity support.
      index("ticket_subscriptions_principal_idx").on(table.principalId),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const ticketSubscriptionsRelations = relations(
  ticketSubscriptions,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketSubscriptions.workspaceId, ticketSubscriptions.ticketId],
      references: [tickets.workspaceId, tickets.id],
    }),
    principal: one(principal, {
      fields: [
        ticketSubscriptions.workspaceId,
        ticketSubscriptions.principalId,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);
