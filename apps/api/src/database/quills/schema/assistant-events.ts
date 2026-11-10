import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
/**
 * Assistant usage events — append-only, one row per teammate interaction with
 * an AI surface (Quinn Copilot outcome loop): an answer/transform/summary
 * inserted into the composer (metadata.destination says whether it landed as
 * a customer-facing reply or an internal note), or an explicit thumbs up/down
 * on an answer.
 * `event_type` is deliberately open text (no CHECK): new AI surfaces add event
 * kinds without a migration, and the reporting scans filter on the exact types
 * they understand, so an unknown type is simply not counted rather than
 * rejected at write time. Never updated after insert — a "changed mind" on
 * feedback is just another row; readers aggregate, they don't reconcile.
 *
 * Both item FKs are nullable with no exactly-one CHECK (unlike
 * assistant_pending_actions): an event is telemetry about a surface, not a
 * child of the item, and future surfaces (e.g. the admin sandbox) have no item
 * at all. Swept after 180 days by tool-audit.ts's retention job, same cadence
 * as assistant_tool_calls.
 */
import { text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";
import { conversations } from "./conversation";
import { tickets } from "./tickets";
import { principal } from "./auth";

export const assistantEvents = quillsSchema
  .table(
    "assistant_events",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("assistant_event")("id").notNull(),
      eventType: text("event_type").notNull(),
      // The acting teammate. SET NULL, not cascade: the event stays countable
      // in the aggregate report after the teammate is deleted.
      principalId: typeIdColumnNullable("principal")("principal_id"),
      conversationId: typeIdColumnNullable("conversation")("conversation_id"),
      ticketId: typeIdColumnNullable("ticket")("ticket_id"),
      metadata: jsonb("metadata")
        .$type<Record<string, unknown>>()
        .notNull()
        .default({}),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Drives the Copilot usage report's per-type date-range scan (event_type
      // IN (...) AND created_at range — see analytics/copilot-usage.ts). The
      // retention sweep's DELETE ... WHERE created_at < cutoff runs unindexed:
      // the daily sweep on a 180-day-capped, low-volume table doesn't warrant a
      // second index the way assistant_tool_calls' per-tool breakdown did.
      index("assistant_events_event_type_created_at_idx").on(
        table.eventType,
        table.createdAt,
      ),
      // Per-conversation / per-ticket event feeds, plus the FK RI lookup when
      // a conversation or ticket is deleted. Partial: most events have only
      // one of the two set.
      index("assistant_events_conversation_idx")
        .on(table.conversationId)
        .where(sql`"conversation_id" IS NOT NULL`),
      index("assistant_events_ticket_idx")
        .on(table.ticketId)
        .where(sql`"ticket_id" IS NOT NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      foreignKey({
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.ticketId],
        foreignColumns: [tickets.workspaceId, tickets.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const assistantEventsRelations = relations(
  assistantEvents,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [assistantEvents.workspaceId, assistantEvents.conversationId],
      references: [conversations.workspaceId, conversations.id],
    }),
    ticket: one(tickets, {
      fields: [assistantEvents.workspaceId, assistantEvents.ticketId],
      references: [tickets.workspaceId, tickets.id],
    }),
  }),
);
