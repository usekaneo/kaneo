import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Pending actions — a write-tool call Quinn proposed but has not executed,
 * awaiting agent approval within a TTL. `proposePendingAction` opens one;
 * `decidePendingAction` moves it to `approved`/`rejected` (only from
 * `proposed`, and only before it expires); the stale-action sweep flips
 * unattended ones to `expired`. `executed`/`failed` land once an approved
 * action actually runs. `assistant_tool_calls.pending_action_id` links the
 * execution audit row back to the proposal that authorized it.
 *
 * `idempotencyKey` mirrors `assistant_tool_calls.idempotency_key` (same
 * `conversationId:latestCustomerMessageId:toolName:hash(args)` shape, see
 * assistant.tools.ts's `resolveIdempotencyKey`): a synthesis retry that
 * re-runs a write-tool call whose first attempt already proposed dedupes
 * onto that row via `proposePendingAction`'s INSERT ... ON CONFLICT DO
 * NOTHING instead of inserting a duplicate. The uniqueness only holds `WHERE
 * status = 'proposed'`, deliberately narrower than `assistant_tool_calls`'
 * key-alone index: this key does NOT uniquely identify a turn the way the
 * tool-call key does, because a copilot turn (surface: 'copilot') has no
 * customer message to key off and always threads `latestCustomerMessageId:
 * null`, so two unrelated copilot turns proposing the same tool with the
 * same args mint the identical key. Scoping to `status = 'proposed'` means
 * that collision only dedupes while the earlier proposal is still live (the
 * actual retry case this exists for, and an arguably-desirable merge of two
 * concurrent identical asks); once it is approved, rejected, expired, or
 * executed, the key is free again and a new, unrelated proposal is never
 * blocked from resurrecting a stale decision.
 *
 * `ticketId` (unified inbox §3.3) makes the parent polymorphic like
 * conversation_messages (conversation_messages_parent_check): a pending
 * action now hangs off a conversation XOR a ticket, so Quinn can propose a
 * write-tool call from a ticket-scoped copilot turn too.
 */
import {
  text,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";
import { conversations } from "./conversation";
import { tickets } from "./tickets";
import { assistantInvolvements } from "./assistant";
import { principal } from "./auth";
import {
  APPROVAL_RISKS,
  APPROVAL_REQUEST_CHANNELS,
  APPROVAL_DECISION_CHANNELS,
  APPROVAL_EXECUTION_STATES,
  type ApprovalRisk,
  type ApprovalRequestChannel,
  type ApprovalDecisionChannel,
  type ApprovalExecutionState,
} from "../types";

export const ASSISTANT_PENDING_ACTION_STATUSES = [
  "proposed",
  "approved",
  "rejected",
  "expired",
  "executed",
  "failed",
] as const;

export type AssistantPendingActionStatus =
  (typeof ASSISTANT_PENDING_ACTION_STATUSES)[number];

export const ASSISTANT_PENDING_ACTION_ORIGIN_ROLES = [
  "customer_support",
  "copilot_qa",
  "workspace_assistant",
] as const;

export {
  APPROVAL_RISKS,
  APPROVAL_REQUEST_CHANNELS,
  APPROVAL_DECISION_CHANNELS,
  APPROVAL_EXECUTION_STATES,
  type ApprovalRisk,
  type ApprovalRequestChannel,
  type ApprovalDecisionChannel,
  type ApprovalExecutionState,
};

export const assistantPendingActions = quillsSchema
  .table(
    "assistant_pending_actions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("assistant_action")("id").notNull(),
      // Polymorphic parent (§3.3): a pending action hangs off a conversation OR a
      // ticket. Both nullable at the column level; the exactly-one CHECK below
      // guarantees precisely one is set.
      conversationId: typeIdColumnNullable("conversation")("conversation_id"),
      ticketId: typeIdColumnNullable("ticket")("ticket_id"),
      // FK declared explicitly below: the default generated name overflows
      // Postgres's 63-byte identifier limit and gets silently truncated, so the
      // TS schema must spell out the truncated name for the drift check to match.
      involvementId: typeIdColumnNullable("assistant_involvement")(
        "involvement_id",
      ),
      workspaceThreadKey: text("workspace_thread_key"),
      toolName: text("tool_name").notNull(),
      args: jsonb("args").$type<Record<string, unknown>>().notNull(),
      summary: text("summary").notNull(),
      originRole: text("origin_role", {
        enum: ASSISTANT_PENDING_ACTION_ORIGIN_ROLES,
      })
        .notNull()
        .default("customer_support"),
      status: text("status", { enum: ASSISTANT_PENDING_ACTION_STATUSES })
        .notNull()
        .default("proposed"),
      proposedAt: timestamp("proposed_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      decidedById: typeIdColumnNullable("principal")("decided_by_id"),
      decidedAt: timestamp("decided_at", { withTimezone: true }),
      executedAt: timestamp("executed_at", { withTimezone: true }),
      result: jsonb("result").$type<Record<string, unknown> | null>(),
      idempotencyKey: text("idempotency_key"),
      // The principal that filed the request (an API key's service principal,
      // the AI assistant, or a person asking in the app). Never the decider.
      requestedById: typeIdColumnNullable("principal")("requested_by_id"),
      // The person whose authority the request borrows. FK declared below with
      // a short name: the generated one overflows Postgres's identifier limit.
      onBehalfOfPrincipalId: typeIdColumnNullable("principal")(
        "on_behalf_of_principal_id",
      ),
      // Unused: nothing writes or reads this column. Due to be dropped.
      requestedVia: text("requested_via", { enum: APPROVAL_REQUEST_CHANNELS }),
      // The credential that filed it (an API key id or an OAuth client id). A
      // decision can never arrive through it.
      credentialId: text("credential_id"),
      clientName: text("client_name"),
      // Unused: no longer written (new rows leave it NULL) and nothing reads it. Due to be dropped.
      risk: text("risk", { enum: APPROVAL_RISKS }),
      // The digest of the exact operation proposed; a decision binds to it.
      argsDigest: text("args_digest"),
      // Unused: nothing writes or reads this column. Due to be dropped.
      contractDigest: text("contract_digest"),
      // Unused: nothing writes or reads this column. Due to be dropped.
      decidedVia: text("decided_via", { enum: APPROVAL_DECISION_CHANNELS }),
      // Unused: nothing writes or reads this column. Due to be dropped.
      decisionReason: text("decision_reason"),
      // Unused: nothing writes or reads this column. Due to be dropped.
      executionState: text("execution_state", {
        enum: APPROVAL_EXECUTION_STATES,
      }),
      // Unused: nothing writes or reads this column. Due to be dropped.
      executionJobId: text("execution_job_id"),
      // Unused: nothing writes or reads this column. Due to be dropped.
      executionError: text("execution_error"),
      // Why a request stopped being decidable without a decision, such as
      // `superseded:merged`.
      disposition: text("disposition"),
    },
    (table) => [
      foreignKey({
        // Truncated from assistant_pending_actions_involvement_id_assistant_involvements_id_fk
        // (see the comment on the column above).
        name: "assistant_pending_actions_involvement_id_assistant_involvements",
        columns: [table.workspaceId, table.involvementId],
        foreignColumns: [
          assistantInvolvements.workspaceId,
          assistantInvolvements.id,
        ],
      }).onDelete("set null"),
      foreignKey({
        name: "assistant_pending_actions_on_behalf_of_fk",
        columns: [table.workspaceId, table.onBehalfOfPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      // Drives "does this conversation have an outstanding proposal" lookups;
      // partial so only live proposals are indexed. Narrowed to conversation_id
      // IS NOT NULL now that the parent is polymorphic (see ticket_proposed_idx
      // below for the ticket-parent counterpart).
      index("assistant_pending_actions_conversation_proposed_idx")
        .on(table.conversationId)
        .where(
          sql`${table.status} = 'proposed' AND ${table.conversationId} IS NOT NULL`,
        ),
      // Ticket-parent counterpart to the conversation index above.
      index("assistant_pending_actions_ticket_proposed_idx")
        .on(table.ticketId)
        .where(
          sql`${table.status} = 'proposed' AND ${table.ticketId} IS NOT NULL`,
        ),
      // Drives the Copilot usage report's actions-funnel date-range scan
      // (analytics/copilot-usage.ts), which has no status predicate in its
      // WHERE clause (the proposed/approved/rejected/expired split is a set of
      // FILTER'd counts inside one aggregate) — plain, not partial or
      // composite, since every row (regardless of status) is in scope.
      index("assistant_pending_actions_proposed_at_idx").on(table.proposedAt),
      // The requests still waiting for a decision, newest first: what the
      // approvals queue and its count read. NULLS FIRST is Postgres's own
      // default for DESC, spelled out to match the migration.
      index("assistant_pending_actions_waiting_idx")
        .on(table.proposedAt.desc().nullsFirst())
        .where(sql`${table.status} = 'proposed'`),
      // The requests already decided, most recent first: what the approvals
      // queue's Decided tab reads.
      index("assistant_pending_actions_decided_idx")
        .on(table.decidedAt.desc().nullsFirst())
        .where(sql`${table.decidedAt} IS NOT NULL`),
      // See the column comment above for why this is scoped to `status =
      // 'proposed'` rather than the key alone.
      uniqueIndex("assistant_pending_actions_idempotency_key_idx")
        .on(table.workspaceId, table.idempotencyKey)
        .where(
          sql`${table.idempotencyKey} IS NOT NULL AND ${table.status} = 'proposed'`,
        ),
      check(
        "assistant_pending_actions_status_check",
        sql`${table.status} IN ('proposed','approved','rejected','expired','executed','failed')`,
      ),
      // At most one parent: a conversation, a ticket, or a workspace thread. A
      // request with none (an API caller's) is decided from the approvals queue.
      check(
        "assistant_pending_actions_parent_check",
        sql`num_nonnulls(${table.conversationId}, ${table.ticketId}, ${table.workspaceThreadKey}) <= 1`,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.ticketId],
        foreignColumns: [tickets.workspaceId, tickets.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.decidedById],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      foreignKey({
        columns: [table.workspaceId, table.requestedById],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const assistantPendingActionsRelations = relations(
  assistantPendingActions,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [
        assistantPendingActions.workspaceId,
        assistantPendingActions.conversationId,
      ],
      references: [conversations.workspaceId, conversations.id],
    }),
    ticket: one(tickets, {
      fields: [
        assistantPendingActions.workspaceId,
        assistantPendingActions.ticketId,
      ],
      references: [tickets.workspaceId, tickets.id],
    }),
    involvement: one(assistantInvolvements, {
      fields: [
        assistantPendingActions.workspaceId,
        assistantPendingActions.involvementId,
      ],
      references: [assistantInvolvements.workspaceId, assistantInvolvements.id],
    }),
  }),
);
