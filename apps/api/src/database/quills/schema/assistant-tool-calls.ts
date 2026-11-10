import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Tool-call audit log — one row per assistant tool invocation. `claimToolCall`
 * inserts the `started` row via INSERT ... ON CONFLICT DO NOTHING on the
 * partial-unique idempotency index, so a retried call (BullMQ redelivery, a
 * duplicated LLM turn) never re-runs its side-effect; a NULL idempotency key
 * never conflicts with another NULL. `finalizeToolCall` fills in the terminal
 * status once the call settles; `recordDeniedToolCall` writes a denial
 * directly since a denied call never attempts its side-effect and needs no
 * claim.
 */
import {
  text,
  timestamp,
  jsonb,
  integer,
  index,
  uniqueIndex,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";
import { conversations } from "./conversation";
import { assistantInvolvements } from "./assistant";
import { assistantPendingActions } from "./assistant-pending-actions";
import { principal } from "./auth";

export const ASSISTANT_TOOL_CALL_STATUSES = [
  "started",
  "succeeded",
  "failed",
  "denied",
  "skipped_duplicate",
] as const;

export type AssistantToolCallStatus =
  (typeof ASSISTANT_TOOL_CALL_STATUSES)[number];

export const assistantToolCalls = quillsSchema
  .table(
    "assistant_tool_calls",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("assistant_tool_call")("id").notNull(),
      conversationId: typeIdColumnNullable("conversation")("conversation_id"),
      // Both FKs below are declared explicitly in the table config: their
      // default generated names overflow Postgres's 63-byte identifier limit
      // and get silently truncated, so the TS schema must spell out the
      // truncated name for the drift check to match.
      involvementId: typeIdColumnNullable("assistant_involvement")(
        "involvement_id",
      ),
      pendingActionId:
        typeIdColumnNullable("assistant_action")("pending_action_id"),
      toolName: text("tool_name").notNull(),
      args: jsonb("args").$type<Record<string, unknown>>().notNull(),
      status: text("status", { enum: ASSISTANT_TOOL_CALL_STATUSES })
        .notNull()
        .default("started"),
      resultSummary: text("result_summary"),
      error: text("error"),
      latencyMs: integer("latency_ms"),
      idempotencyKey: text("idempotency_key"),
      principalId: typeIdColumnNullable("principal")("principal_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      foreignKey({
        // Truncated from assistant_tool_calls_involvement_id_assistant_involvements_id_fk.
        name: "assistant_tool_calls_involvement_id_assistant_involvements_id_f",
        columns: [table.workspaceId, table.involvementId],
        foreignColumns: [
          assistantInvolvements.workspaceId,
          assistantInvolvements.id,
        ],
      }).onDelete("set null"),
      foreignKey({
        // Truncated from assistant_tool_calls_pending_action_id_assistant_pending_actions_id_fk.
        name: "assistant_tool_calls_pending_action_id_assistant_pending_action",
        columns: [table.workspaceId, table.pendingActionId],
        foreignColumns: [
          assistantPendingActions.workspaceId,
          assistantPendingActions.id,
        ],
      }).onDelete("set null"),
      index("assistant_tool_calls_conversation_id_created_at_idx").on(
        table.conversationId,
        table.createdAt,
      ),
      // Drives the Quinn performance dashboard's succeeded-actions date-range scan.
      index("assistant_tool_calls_status_created_at_idx").on(
        table.status,
        table.createdAt,
      ),
      // Plain created_at: quinn-tools.ts's per-tool breakdown filters ONLY on
      // created_at (status is a FILTER inside the aggregate, not a WHERE
      // predicate), so the composite (status, created_at) index above can't
      // serve it — a range scan needs created_at as the index's leading column.
      // Also backs the 180-day retention sweep's DELETE ... WHERE created_at <
      // cutoff (usage-log.ts's cleanupExpiredLogs pattern, extended to this table).
      index("assistant_tool_calls_created_at_idx").on(table.createdAt),
      // Partial so two NULL idempotency keys (calls with no stable key) never conflict.
      uniqueIndex("assistant_tool_calls_idempotency_key_idx")
        .on(table.workspaceId, table.idempotencyKey)
        .where(sql`${table.idempotencyKey} IS NOT NULL`),
      check(
        "assistant_tool_calls_status_check",
        sql`${table.status} IN ('started','succeeded','failed','denied','skipped_duplicate')`,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const assistantToolCallsRelations = relations(
  assistantToolCalls,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [
        assistantToolCalls.workspaceId,
        assistantToolCalls.conversationId,
      ],
      references: [conversations.workspaceId, conversations.id],
    }),
    involvement: one(assistantInvolvements, {
      fields: [
        assistantToolCalls.workspaceId,
        assistantToolCalls.involvementId,
      ],
      references: [assistantInvolvements.workspaceId, assistantInvolvements.id],
    }),
    pendingAction: one(assistantPendingActions, {
      fields: [
        assistantToolCalls.workspaceId,
        assistantToolCalls.pendingActionId,
      ],
      references: [
        assistantPendingActions.workspaceId,
        assistantPendingActions.id,
      ],
    }),
  }),
);
