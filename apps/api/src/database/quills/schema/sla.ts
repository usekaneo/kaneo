import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * SLA policies + events (support platform §4.6). Named reusable policies applied
 * ONLY via the Apply-SLA workflow action; clocks are office-hours-aware. The
 * `sla_events` log is the append-only breach/response timeline the lazy breach
 * evaluator reads. Per-workspace DB, so no workspace column.
 */
import {
  text,
  integer,
  boolean,
  jsonb,
  timestamp,
  index,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { officeHoursSchedules } from "./office-hours";
import { conversations } from "./conversation";
import { tickets } from "./tickets";

export const slaPolicies = quillsSchema
  .table(
    "sla_policies",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("sla_policy")("id").notNull(),
      name: text("name").notNull(),
      firstResponseTargetSecs: integer("first_response_target_secs"),
      nextResponseTargetSecs: integer("next_response_target_secs"),
      timeToCloseTargetSecs: integer("time_to_close_target_secs"),
      // Ticket-side clock: seconds from ticket-SLA application to the ticket
      // reaching a 'closed'-category status. NULL = the policy doesn't track TTR.
      timeToResolveTargetSecs: integer("time_to_resolve_target_secs"),
      pauseOnSnooze: boolean("pause_on_snooze").notNull().default(true),
      // Ticket twin of pause_on_snooze: pause TTR while the ticket sits in a
      // 'pending'-category status (waiting on customer / third party).
      pauseOnPending: boolean("pause_on_pending").notNull().default(true),
      officeHoursScheduleId: typeIdColumnNullable("office_hours")(
        "office_hours_schedule_id",
      ),
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
        name: "sla_policies_office_hours_schedule_id_fkey",
        columns: [table.workspaceId, table.officeHoursScheduleId],
        foreignColumns: [
          officeHoursSchedules.workspaceId,
          officeHoursSchedules.id,
        ],
      }).onDelete("set null"),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const slaEvents = quillsSchema
  .table(
    "sla_events",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("sla_event")("id").notNull(),
      // Polymorphic subject: conversation clocks (FRT/NRT/TTC) log with
      // conversation_id; the ticket TTR clock logs with ticket_id and a NULL
      // conversation_id (back-office tickets have no conversation). Exactly one
      // is set — enforced by sla_events_subject_check.
      conversationId: typeIdColumnNullable("conversation")("conversation_id"),
      ticketId: typeIdColumnNullable("ticket")("ticket_id"),
      policyId: typeIdColumn("sla_policy")("policy_id").notNull(),
      kind: text("kind").notNull(),
      meta: jsonb("meta")
        .$type<Record<string, unknown>>()
        .notNull()
        .default(sql`'{}'::jsonb`),
      at: timestamp("at", { withTimezone: true }).defaultNow().notNull(),
    },
    (table) => [
      foreignKey({
        name: "sla_events_conversation_id_fkey",
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "sla_events_ticket_id_fkey",
        columns: [table.workspaceId, table.ticketId],
        foreignColumns: [tickets.workspaceId, tickets.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "sla_events_policy_id_fkey",
        columns: [table.workspaceId, table.policyId],
        foreignColumns: [slaPolicies.workspaceId, slaPolicies.id],
      }).onDelete("restrict"),
      check(
        "sla_events_subject_check",
        sql`${table.conversationId} IS NOT NULL OR ${table.ticketId} IS NOT NULL`,
      ),
      index("sla_events_conversation_at_idx").on(
        table.conversationId,
        table.at,
      ),
      index("sla_events_ticket_at_idx").on(table.ticketId, table.at),
      // Reporting group-by (attainment per policy over a range).
      index("sla_events_policy_at_idx").on(table.policyId, table.at),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type SlaPolicy = typeof slaPolicies.$inferSelect;
export type SlaEvent = typeof slaEvents.$inferSelect;
