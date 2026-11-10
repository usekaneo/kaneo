import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { unique } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
  integer,
  boolean,
  primaryKey,
  foreignKey,
  check,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import { workspaceAssistantThreads } from "./workspace-assistant";
import { teams } from "./teams";
import { channelAccounts } from "./channel-accounts";
// conversation <-> tickets is a mutual import cycle (tickets FKs conversations,
// and conversation_messages FKs tickets). It is safe only because every
// cross-table reference lives inside drizzle's deferred FK/relation callbacks;
// keep `tickets` out of any module-eval-time (top-level) use here.
import { tickets } from "./tickets";
import {
  CONVERSATION_STATUSES,
  MESSAGE_SENDER_TYPES,
  CHANNELS,
  CONVERSATION_PRIORITIES,
} from "../types";
import type {
  ConversationAttachment,
  ConversationMessageCitation,
  ConversationMessageMetadata,
  TiptapContent,
} from "../types";

// Full-text search vector (generated column), mirroring posts/kb.
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

/**
 * Support-inbox conversations — one thread between a visitor (anonymous or
 * identified) and the team, arriving via any channel (messenger, email, ...).
 * Scoped to the workspace by the database connection (database-per-workspace); no
 * workspace column.
 */
export const conversations = quillsSchema
  .table(
    "conversations",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("conversation")("id").notNull(),
      // The visitor side of the conversation. `restrict` so a principal that
      // owns chat history can never be silently orphaned — the anonymous→
      // identified merge re-points this column (see merge-anonymous.ts).
      visitorPrincipalId: typeIdColumn("principal")(
        "visitor_principal_id",
      ).notNull(),
      // The team member currently handling the conversation (nullable: an open
      // conversation may be unassigned). `set null` mirrors other actor FKs.
      assignedAgentPrincipalId: typeIdColumnNullable("principal")(
        "assigned_agent_principal_id",
      ),
      // The team the conversation is assigned to (§4.12). Independent of the
      // agent assignee: a conversation may be assigned to a team, a teammate, or
      // both, and assigning one never clears the other. `set null` so a deleted
      // team leaves the conversation team-unassigned rather than orphaned.
      assignedTeamId: typeIdColumnNullable("team")("assigned_team_id"),
      status: text("status", { enum: CONVERSATION_STATUSES })
        .notNull()
        .default("open"),
      // Snooze wake time for a 'snoozed' conversation. NULL while snoozed means
      // "until the customer next replies" (a customer message always wakes it); a
      // timestamp is a timer the sweeper trips to reopen the thread.
      snoozedUntil: timestamp("snoozed_until", { withTimezone: true }),
      // When the customer started waiting on a reply: set on a customer message
      // when currently NULL, cleared on any teammate/assistant reply. Drives the
      // waiting-longest inbox ordering. NULL = nobody is waiting.
      waitingSince: timestamp("waiting_since", { withTimezone: true }),
      // Inbound source discriminator for the unified inbox. Only 'widget' exists
      // today; email and other sources join in later phases. NOT NULL so a new
      // source can never be silently mislabeled by an omitted insert.
      source: text("source").notNull().default("widget"),
      // Per-conversation extensible metadata (B2B custom fields). Empty object by
      // default; the app owns the shape.
      customAttributes: jsonb("custom_attributes")
        .$type<Record<string, unknown>>()
        .notNull()
        .default({}),
      // The channel this conversation is CURRENTLY conducted on — set by every
      // create path and then promoted as the customer moves surfaces (a widget
      // thread answered from a mailbox becomes 'email'). For the channel it
      // ARRIVED on, which never changes, read `source` instead; anything asking a
      // provenance question must use that column, not this one. No default, so a
      // conversation on a new channel can never be silently labeled messenger by
      // an omitted insert (the NOT NULL makes an omission fail loud).
      channel: text("channel", { enum: CHANNELS }).notNull(),
      // Agent-set triage priority. 'none' = unset (the default for every row).
      priority: text("priority", { enum: CONVERSATION_PRIORITIES })
        .notNull()
        .default("none"),
      // Optional human-readable subject, derived from the first message for the
      // inbox list. Plain text.
      subject: text("subject"),
      // Denormalized last-message preview + timestamp drive the inbox feed
      // (sort + at-a-glance) without a per-row subquery.
      lastMessagePreview: text("last_message_preview"),
      lastMessageAt: timestamp("last_message_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      // Read receipts power unread badges on each side independently.
      visitorLastReadAt: timestamp("visitor_last_read_at", {
        withTimezone: true,
      }),
      agentLastReadAt: timestamp("agent_last_read_at", { withTimezone: true }),
      // Post-conversation CSAT rating (1-5), submitted by the visitor.
      csatRating: integer("csat_rating"),
      csatComment: text("csat_comment"),
      csatSubmittedAt: timestamp("csat_submitted_at", { withTimezone: true }),
      // When the conversation was resolved/closed (set on close, cleared on
      // reopen). Drives resolution reporting and the resolved-vs-active split.
      resolvedAt: timestamp("resolved_at", { withTimezone: true }),
      // Why the conversation was ended + an optional free-text note. The taxonomy
      // is enforced at the app layer (CONVERSATION_END_REASONS). Stored to power
      // resolution-rate reporting: resolved-rate = count(end_reason IN
      // ('resolved','tracked_as_feedback')) / count(all ended EXCLUDING 'spam').
      endReason: text("end_reason"),
      endNote: text("end_note"),
      // Which rule or classifier filed a spam-ended conversation (the
      // deterministic signals, the AI classifier, or an agent). App-layer
      // taxonomy (CONVERSATION_SPAM_FILED_BY); null for non-spam threads and
      // cleared by restore-from-spam.
      spamReason: text("spam_reason"),
      // Optional contact email captured from an anonymous visitor for offline
      // follow-up. Agent-only; the principal itself stays anonymous.
      visitorEmail: text("visitor_email"),
      // The email inbound route this conversation arrived on (§4.8/§4.9). Null for
      // messenger; set to the workspace's inbound channel_account for
      // email. `set null` so a removed inbox leaves history rather than orphaning it.
      channelAccountId:
        typeIdColumnNullable("channel_account")("channel_account_id"),
      // The one active SLA applied to this conversation (§4.6 reserved seam), or
      // null. The Apply-SLA workflow action (a later slice) owns the shape.
      slaApplied: jsonb("sla_applied").$type<Record<string, unknown>>(),
      // Two-way inbox translation (P2-D.1). Detected once (best-effort, from the
      // visitor's recent messages) and cached here rather than re-run on every
      // read; null until a detection attempt has succeeded. Plain columns, not a
      // bundled jsonb blob, mirroring how the conversation row already stores
      // other per-conversation UI state (priority, snoozedUntil, assignedTeamId).
      detectedCustomerLanguage: text("detected_customer_language"),
      // Per-conversation manual activation toggle. Independent of detection: a
      // teammate can turn translation on/off regardless of whether (or what)
      // language was detected.
      translationEnabled: boolean("translation_enabled")
        .notNull()
        .default(false),
      // Set when a teammate dismisses the auto-suggest banner ("This customer
      // writes in French. Translate this conversation?") so it never resurfaces
      // for this conversation. Null = never dismissed (or translation already on).
      translationDismissedAt: timestamp("translation_dismissed_at", {
        withTimezone: true,
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true }),
    },
    (table) => [
      // FK names match the constraints the SQL migration created.
      foreignKey({
        name: "conversations_visitor_principal_id_fkey",
        columns: [table.workspaceId, table.visitorPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("restrict"),
      foreignKey({
        name: "conversations_assigned_agent_principal_id_fkey",
        columns: [table.workspaceId, table.assignedAgentPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      foreignKey({
        name: "conversations_assigned_team_id_fkey",
        columns: [table.workspaceId, table.assignedTeamId],
        foreignColumns: [teams.workspaceId, teams.id],
      }).onDelete("set null"),
      foreignKey({
        name: "conversations_channel_account_id_fkey",
        columns: [table.workspaceId, table.channelAccountId],
        foreignColumns: [channelAccounts.workspaceId, channelAccounts.id],
      }).onDelete("set null"),
      index("conversations_channel_account_id_idx").on(table.channelAccountId),
      // Inbox feed: list by status, newest activity first.
      index("conversations_status_last_message_idx").on(
        table.status,
        table.lastMessageAt,
      ),
      // Cross-status keyset feed (D17): last activity first with an id tiebreak, so
      // the unfiltered inbox pages deterministically without leaning on the status
      // composite above. nullsFirst matches postgres's default for plain DESC.
      index("conversations_last_message_at_id_idx").on(
        table.lastMessageAt.desc().nullsFirst(),
        table.id,
      ),
      // Keyset support for the 'created' saved-view sort (created_at DESC, id).
      // nullsFirst matches the migration's plain DESC (postgres default).
      index("conversations_created_at_id_idx").on(
        table.createdAt.desc().nullsFirst(),
        table.id,
      ),
      // Keyset support for the 'waiting' sort: longest-waiting first, NULL (nobody
      // waiting) rows last, id tiebreak.
      index("conversations_waiting_since_id_idx").on(
        table.waitingSince.asc().nullsLast(),
        table.id,
      ),
      index("conversations_visitor_principal_idx").on(table.visitorPrincipalId),
      index("conversations_assigned_agent_idx").on(
        table.assignedAgentPrincipalId,
      ),
      // Team inbox view: only team-assigned rows are indexed (partial).
      index("conversations_assigned_team_idx")
        .on(table.assignedTeamId)
        .where(sql`assigned_team_id IS NOT NULL`),
      // Sweeper wake pass: only timer-snoozed rows have a due wake time, so a
      // partial index over them keeps the periodic sweep cheap.
      index("conversations_snoozed_until_idx")
        .on(table.snoozedUntil)
        .where(sql`status = 'snoozed' AND snoozed_until IS NOT NULL`),
      // Spam retention sweep (conversation.spam-retention.ts): the same shape as
      // the snooze wake above, over the spam-filed candidate set. Ordered on the
      // FILING instant, which is the clock the retention window is measured from;
      // restore-from-spam clears end_reason, so a released thread leaves this
      // index rather than lingering in it (migration 0252).
      // Workspace search by subject (0309).
      index("conversations_subject_search_idx").using(
        "gin",
        sql`to_tsvector('english', coalesce(${table.subject}, ''))`,
      ),
      // Workspace search: a subject containing the query anywhere inside (0309).
      index("conversations_subject_trgm_idx").using(
        "gin",
        table.subject.op("gin_trgm_ops"),
      ),
      index("conversations_spam_resolved_at_idx")
        .on(table.resolvedAt)
        .where(sql`status = 'closed' AND end_reason = 'spam'`),
      // SLA sweep passes (sla.service.ts's sweepOverdueSlaBreaches +
      // sweepApproachingSlaBreaches + sweepSlaBreachTriggers, via the shared
      // scanAndClaimSlaClocks) all scan on `sla_applied IS NOT NULL` plus "at
      // least one clock still unsettled" as their base filter, with every
      // further predicate evaluated against JSON keys inside that column (no
      // other single column narrows the scan). `sla_applied` is never cleared
      // once set (a settle just flips fields on the same blob), so a plain
      // `IS NOT NULL` predicate's selectivity degrades monotonically as a
      // workspace ages — narrowed to the real, bounded candidate set instead
      // (migration 0187, replacing 0186's `conversations_sla_applied_idx`;
      // widened by 0213 with the armed-but-unsettled next-response arm, which
      // must test `nextResponseDueAt IS NOT NULL` too — nextResponseAt is
      // absent-until-settled, so a bare `IS NULL` arm would match nearly every
      // stamp; see that migration's own comment and scanAndClaimSlaClocks'
      // matching extra AND clause for why the predicate is repeated verbatim
      // there).
      index("conversations_sla_unsettled_idx")
        .on(table.id)
        .where(
          sql`sla_applied IS NOT NULL AND ((sla_applied ->> 'firstResponseAt') IS NULL OR (sla_applied ->> 'resolvedAt') IS NULL OR ((sla_applied ->> 'nextResponseDueAt') IS NOT NULL AND (sla_applied ->> 'nextResponseAt') IS NULL))`,
        ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Individual chat messages. Flat (no threading), plain-text content. Author is
 * always a real principal; the visitor-facing welcome message is rendered from
 * settings, not stored, so there are no author-less rows.
 *
 * THE XOR PARENT RULE + THE UNION READ CONTRACT (convergence,
 * scratchpad/convergence-design.md): every row hangs off exactly ONE parent —
 * `conversation_id` XOR `ticket_id`, enforced by the
 * `conversation_messages_parent_check` CHECK below and served by one
 * (parent, created_at, id) index per parent. A customer ticket SHARES its
 * linked conversation's thread, so the pair's thread is the read-path UNION
 * of both parents' rows (pair-thread.service.ts merges two keyset pages in
 * code; `is_internal` filters both parents alike for requester audiences).
 * New customer-visible writes for a linked pair land on the CONVERSATION
 * parent, and migration 0218 (convergence Phase 6 — literal convergence)
 * re-parented every legacy pre-convergence customer-visible row the same
 * way: post-0218, customer-visible messages are conversation-parented
 * ALWAYS. Ticket-parented rows are internal notes (team-only) plus
 * back-office/tracker threads — the one customer-visible exception is the
 * inert legacy edge 0218 deliberately skipped (standalone customer tickets
 * with no requester, or soft-deleted), which the union loader keeps reading
 * forever. Back-office/tracker tickets keep a purely ticket-parented
 * internal-notes thread.
 */
export const conversationMessages = quillsSchema
  .table(
    "conversation_messages",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("conversation_msg")("id").notNull(),
      // Polymorphic parent: a message hangs off a conversation OR a ticket (support
      // platform §4.2). Both nullable at the column level; the exactly-one CHECK
      // below guarantees precisely one is set.
      conversationId: typeIdColumnNullable("conversation")("conversation_id"),
      ticketId: typeIdColumnNullable("ticket")("ticket_id"),
      // Retired Home chat transcripts only. Nothing writes it now; existing rows
      // stay and remain hidden from every public read.
      workspaceThreadKey: text("workspace_thread_key"),
      // Nullable: system events (e.g. assignment notices) have no human author.
      principalId: typeIdColumnNullable("principal")("principal_id"),
      // Explicit sender side for rendering + authorization, independent of the
      // principal's current role (a team member could also be a visitor).
      senderType: text("sender_type", { enum: MESSAGE_SENDER_TYPES }).notNull(),
      content: text("content").notNull(),
      // Rich TipTap doc for messages that carry structured content (agent notes
      // with @-mentions). Null for plain messenger/email messages, which render
      // from `content`. Mirrors comments/posts `content_json`.
      contentJson: jsonb("content_json").$type<TiptapContent>(),
      // Agent-only internal note — never sent to or visible to the visitor.
      isInternal: boolean("is_internal").notNull().default(false),
      // Image/file attachments (client-safe refs); null/empty for text-only messages.
      attachments: jsonb("attachments").$type<ConversationAttachment[]>(),
      // KB sources the AI assistant grounded this reply in; the content carries
      // inline [n] markers that index this ordered list. Null for human messages.
      citations: jsonb("citations").$type<ConversationMessageCitation[]>(),
      // Channel provenance (e.g. inbound email message-id for retry dedupe); null
      // for ordinary in-app messenger messages.
      metadata: jsonb("metadata").$type<ConversationMessageMetadata>(),
      // FTS over message content; backs ticket search + the inbox FTS upgrade.
      searchVector: tsvector("search_vector").generatedAlwaysAs(
        sql`to_tsvector('english', coalesce(content, ''))`,
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true }),
      // Set when a person edits the message body. Distinct from updatedAt, which
      // also moves on soft-delete. Null until the first edit; the thread renders
      // it as a small "(edited)" mark beside the timestamp.
      editedAt: timestamp("edited_at", { withTimezone: true }),
      // Soft delete support, mirroring comments.
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
      deletedByPrincipalId: typeIdColumnNullable("principal")(
        "deleted_by_principal_id",
      ),
    },
    (table) => [
      // FK names match the constraints the SQL migration created.
      foreignKey({
        name: "conversation_messages_conversation_id_fkey",
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "conversation_messages_ticket_id_fkey",
        columns: [table.workspaceId, table.ticketId],
        foreignColumns: [tickets.workspaceId, tickets.id],
      }).onDelete("cascade"),
      // Exactly one parent: a message belongs to a conversation XOR a ticket.
      check(
        "conversation_messages_parent_check",
        sql`num_nonnulls(${table.conversationId}, ${table.ticketId}, ${table.workspaceThreadKey}) = 1`,
      ),
      foreignKey({
        name: "conversation_messages_workspace_thread_key_fkey",
        columns: [table.workspaceId, table.workspaceThreadKey],
        foreignColumns: [
          workspaceAssistantThreads.workspaceId,
          workspaceAssistantThreads.key,
        ],
      }).onDelete("cascade"),
      check(
        "conversation_messages_workspace_internal_check",
        sql`${table.workspaceThreadKey} IS NULL OR ${table.isInternal} = true`,
      ),
      index("conversation_messages_workspace_created_idx")
        .on(table.workspaceThreadKey, table.createdAt, table.id)
        .where(sql`${table.workspaceThreadKey} IS NOT NULL`),
      uniqueIndex("conversation_messages_workspace_run_sender_idx")
        .on(
          table.workspaceId,
          table.workspaceThreadKey,
          sql`(${table.metadata}->'workspaceTurn'->>'runId')`,
          table.senderType,
        )
        .where(sql`${table.workspaceThreadKey} IS NOT NULL`),
      foreignKey({
        name: "conversation_messages_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("restrict"),
      foreignKey({
        name: "conversation_messages_deleted_by_principal_id_fkey",
        columns: [table.workspaceId, table.deletedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      // Live feed + keyset pagination on the composite (conversationId, createdAt, id);
      // id is the tie-break so same-microsecond siblings page deterministically.
      index("conversation_messages_conversation_created_idx").on(
        table.conversationId,
        table.createdAt,
        table.id,
      ),
      // Ticket-thread keyset pagination, mirroring the conversation index.
      index("conversation_messages_ticket_created_idx").on(
        table.ticketId,
        table.createdAt,
        table.id,
      ),
      index("conversation_messages_principal_idx").on(table.principalId),
      // RI-lookup protection for principal deletion; partial because the
      // deleted_by audit column is null on all live messages.
      index("conversation_messages_deleted_by_principal_idx")
        .on(table.deletedByPrincipalId)
        .where(sql`"deleted_by_principal_id" IS NOT NULL`),
      // The `my_tone` transform's style-mining query (copilot-transform.ts's
      // fetchTeammateStyleExcerpts): principal_id + sender_type='agent' +
      // is_internal=false + deleted_at IS NULL, ordered by created_at DESC
      // LIMIT 10. The plain principal_id index above doesn't serve the
      // ordering or the other three predicates; this partial index matches
      // the query exactly.
      index("conversation_messages_style_mining_idx")
        .on(table.principalId, table.createdAt.desc().nullsFirst())
        .where(
          sql`${table.senderType} = 'agent' AND ${table.isInternal} = false AND ${table.deletedAt} IS NULL`,
        ),
      index("conversation_messages_created_at_idx").on(table.createdAt),
      // Backs the inbox list's batched unread-count query (conversation.query.ts):
      // count visitor-authored, non-internal, live messages per conversation with
      // created_at compared against the agent's last-read watermark. The partial
      // predicate matches the query's fixed filters exactly, so only the relevant
      // sliver of messages is indexed; (conversation_id, created_at) serves both
      // the IN grouping and the watermark range check.
      index("conversation_messages_unread_count_idx")
        .on(table.conversationId, table.createdAt)
        .where(
          sql`${table.senderType} = 'visitor' AND ${table.deletedAt} IS NULL AND ${table.isInternal} = false`,
        ),
      index("conversation_messages_search_vector_idx").using(
        "gin",
        table.searchVector,
      ),
      index("conversation_messages_content_trgm_idx")
        .using("gin", sql`${table.content} gin_trgm_ops`)
        .where(sql`${table.deletedAt} IS NULL`),
      // Inbound-email dedupe: one message per provider Message-ID.
      uniqueIndex("conversation_messages_email_message_id_idx")
        .using("btree", table.workspaceId, sql`(metadata ->> 'emailMessageId')`)
        .where(sql`(metadata ->> 'emailMessageId') IS NOT NULL`),
      // Inbound GitHub comment dedupe: one message per REST comment id.
      uniqueIndex("conversation_messages_github_comment_id_idx")
        .using(
          "btree",
          table.workspaceId,
          sql`(metadata ->> 'githubCommentId')`,
        )
        .where(sql`(metadata ->> 'githubCommentId') IS NOT NULL`),
      // Inbound-webhook dedupe: one external-status system note per (ticket,
      // delivery) — a redelivered tracker webhook no-ops instead of double-noting
      // (same idiom as emailMessageId above; one delivery fans to many tickets,
      // hence the composite).
      uniqueIndex("conversation_messages_inbound_delivery_key_idx")
        .using(
          "btree",
          table.workspaceId,
          table.ticketId,
          sql`(metadata ->> 'inboundDeliveryKey')`,
        )
        .where(sql`(metadata ->> 'inboundDeliveryKey') IS NOT NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Per-(message, locale) translation cache for the INCOMING direction of P2-D.1
 * two-way inbox translation, mirroring kb_article_translations' (parentId,
 * locale) -> content shape. `conversation_messages.content`/`content_json` are
 * NEVER mutated by a display translation — this table is the only place a
 * translated rendering of a customer message lives. Keyed by locale (not just
 * "the" translation) because different teammates viewing the same message may
 * have different preferred languages. The OUTGOING direction (a teammate's
 * reply translated to the customer's language before sending) does not use
 * this table: the translation IS the stored message content there, and the
 * teammate's pre-translation original is preserved on that message's own
 * `metadata.translatedFrom` instead — a per-viewer-language cache row makes no
 * sense for a value that's always read back in the one customer language.
 */
export const conversationMessageTranslations = quillsSchema
  .table(
    "conversation_message_translations",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("conversation_msg_translation")("id").notNull(),
      conversationMessageId: typeIdColumn("conversation_msg")(
        "conversation_message_id",
      ).notNull(),
      locale: text("locale").notNull(),
      content: text("content").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Named explicitly (rather than inline .references()) because the
      // conventional auto-derived name for this table+column combination is
      // over Postgres's 63-byte identifier limit and gets silently truncated —
      // an explicit short name keeps the schema and the hand-written SQL
      // migration in exact agreement.
      foreignKey({
        name: "conversation_message_translations_message_id_fkey",
        columns: [table.workspaceId, table.conversationMessageId],
        foreignColumns: [
          conversationMessages.workspaceId,
          conversationMessages.id,
        ],
      }).onDelete("cascade"),
      uniqueIndex("conversation_message_translations_unique_idx").on(
        table.workspaceId,
        table.conversationMessageId,
        table.locale,
      ),
      // Backs the 180-day retention sweep's DELETE ... WHERE created_at < cutoff
      // (mirrors assistant_tool_calls_created_at_idx / tool-audit.ts's pattern).
      index("conversation_message_translations_created_at_idx").on(
        table.createdAt,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Conversation tags — agent-managed, org-wide, created on the fly from a
 * conversation and used to filter the inbox. Same shape as the feedback tag
 * catalog (type ConversationTag mirrors PostTag) but intentionally SEPARATE: the two
 * share no rows, ids, or lifecycle, so a tag here never leaks into feedback
 * boards and vice-versa. Applied to conversations via `conversation_tag_assignments`.
 */
export const conversationTags = quillsSchema
  .table(
    "conversation_tags",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("conversation_tag")("id").notNull(),
      // Constraint name matches what the SQL migration created.
      name: text("name").notNull(),
      color: text("color").default("#6b7280").notNull(),
      description: text("description"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      // Soft delete: a removed tag detaches from conversations but keeps history.
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      index("conversation_tags_deleted_at_idx").on(table.deletedAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.name),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Join table: which conversation tags are applied to which conversation. Both FKs
 * cascade, so removing a conversation or hard-deleting a tag row cleans up.
 */
export const conversationTagAssignments = quillsSchema
  .table(
    "conversation_tag_assignments",
    {
      workspaceId: workspaceColumn(),
      conversationId: typeIdColumn("conversation")("conversation_id").notNull(),
      conversationTagId: typeIdColumn("conversation_tag")(
        "conversation_tag_id",
      ).notNull(),
    },
    (table) => [
      // FK names match the constraints the SQL migration created.
      foreignKey({
        name: "conversation_tag_assignments_conversation_id_fkey",
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "conversation_tag_assignments_conversation_tag_id_fkey",
        columns: [table.workspaceId, table.conversationTagId],
        foreignColumns: [conversationTags.workspaceId, conversationTags.id],
      }).onDelete("cascade"),
      uniqueIndex("conversation_tag_assignments_pk").on(
        table.workspaceId,
        table.conversationId,
        table.conversationTagId,
      ),
      index("conversation_tag_assignments_tag_idx").on(table.conversationTagId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Join table: the customers an agent has added to a conversation beyond its
 * primary visitor (§4.8 group threads). A participant receives every
 * subsequent agent reply by email (the notify fan-out reads this table). Both
 * FKs cascade; the adding teammate is attribution only and goes NULL if that
 * principal is removed.
 */
export const conversationParticipants = quillsSchema
  .table(
    "conversation_participants",
    {
      workspaceId: workspaceColumn(),
      conversationId: typeIdColumn("conversation")("conversation_id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      addedByPrincipalId: typeIdColumnNullable("principal")(
        "added_by_principal_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => [
      // Constraint names match what the SQL migration created.
      foreignKey({
        name: "conversation_participants_conversation_id_fkey",
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "conversation_participants_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "conversation_participants_added_by_fkey",
        columns: [table.workspaceId, table.addedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      uniqueIndex("conversation_participants_pk").on(
        table.workspaceId,
        table.conversationId,
        table.principalId,
      ),
      index("conversation_participants_conversation_id_idx").on(
        table.conversationId,
      ),
      index("conversation_participants_principal_id_idx").on(table.principalId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Join table: every @-mention of a team member inside a chat message (internal
 * notes only — mentions stay team-internal). Mirrors post_mentions: one row per
 * (message, principal), `notifiedAt` watermarks delivery so re-edits don't
 * re-notify, and (principal_id, created_at DESC) serves the "mentions of me"
 * inbox view straight from the index.
 */
export const conversationMessageMentions = quillsSchema
  .table(
    "conversation_message_mentions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("conversation_msg_mention")("id").notNull(),
      conversationMessageId: typeIdColumn("conversation_msg")(
        "conversation_message_id",
      ).notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      notifiedAt: timestamp("notified_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => [
      // FK names match the constraints the SQL migration created.
      foreignKey({
        name: "conversation_message_mentions_conversation_message_id_fkey",
        columns: [table.workspaceId, table.conversationMessageId],
        foreignColumns: [
          conversationMessages.workspaceId,
          conversationMessages.id,
        ],
      }).onDelete("cascade"),
      foreignKey({
        name: "conversation_message_mentions_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      uniqueIndex("conversation_message_mentions_message_principal_uq").on(
        table.workspaceId,
        table.conversationMessageId,
        table.principalId,
      ),
      // nullsFirst matches the migration's plain DESC (postgres default).
      index("conversation_message_mentions_principal_idx").on(
        table.principalId,
        table.createdAt.desc().nullsFirst(),
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Emoji reactions on a chat message — agent-only, mirroring comment_reactions.
 * One row per (message, principal, emoji); the unique index makes a repeat
 * reaction idempotent. Both FKs cascade. Never exposed to the visitor: loaded
 * only on the agent enrichment path and broadcast only on the inbox channel.
 */
export const conversationMessageReactions = quillsSchema
  .table(
    "conversation_message_reactions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("conversation_msg_reaction")("id").notNull(),
      conversationMessageId: typeIdColumn("conversation_msg")(
        "conversation_message_id",
      ).notNull(),
      // Required — only authenticated team members can react.
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      emoji: text("emoji").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // FK names match the constraints the SQL migration created.
      foreignKey({
        name: "conversation_message_reactions_conversation_message_id_fkey",
        columns: [table.workspaceId, table.conversationMessageId],
        foreignColumns: [
          conversationMessages.workspaceId,
          conversationMessages.id,
        ],
      }).onDelete("cascade"),
      foreignKey({
        name: "conversation_message_reactions_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      index("conversation_message_reactions_principal_idx").on(
        table.principalId,
      ),
      uniqueIndex("conversation_message_reactions_unique_idx").on(
        table.workspaceId,
        table.conversationMessageId,
        table.principalId,
        table.emoji,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Per-agent "Saved for later" flag on a chat message. The composite (message,
 * principal) primary key means each agent flags messages independently — a flag
 * is a personal triage marker, not a shared team signal. Both FKs cascade.
 * Agent-only. The (principal, flagged_at DESC) index serves the per-agent feed.
 */
export const conversationMessageFlags = quillsSchema
  .table(
    "conversation_message_flags",
    {
      workspaceId: workspaceColumn(),
      conversationMessageId: typeIdColumn("conversation_msg")(
        "conversation_message_id",
      ).notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      flaggedAt: timestamp("flagged_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Constraint names match what the SQL migration created.
      primaryKey({
        name: "conversation_message_flags_pkey",
        columns: [
          table.workspaceId,
          table.conversationMessageId,
          table.principalId,
        ],
      }),
      foreignKey({
        name: "conversation_message_flags_conversation_message_id_fkey",
        columns: [table.workspaceId, table.conversationMessageId],
        foreignColumns: [
          conversationMessages.workspaceId,
          conversationMessages.id,
        ],
      }).onDelete("cascade"),
      foreignKey({
        name: "conversation_message_flags_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      // nullsFirst matches the migration's plain DESC (postgres default).
      index("conversation_message_flags_principal_idx").on(
        table.principalId,
        table.flaggedAt.desc().nullsFirst(),
      ),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const conversationsRelations = relations(conversations, ({ many }) => ({
  messages: many(conversationMessages),
  tags: many(conversationTagAssignments),
}));

export const conversationTagsRelations = relations(
  conversationTags,
  ({ many }) => ({
    conversationTagAssignments: many(conversationTagAssignments),
  }),
);

export const conversationTagAssignmentsRelations = relations(
  conversationTagAssignments,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [
        conversationTagAssignments.workspaceId,
        conversationTagAssignments.conversationId,
      ],
      references: [conversations.workspaceId, conversations.id],
    }),
    tag: one(conversationTags, {
      fields: [
        conversationTagAssignments.workspaceId,
        conversationTagAssignments.conversationTagId,
      ],
      references: [conversationTags.workspaceId, conversationTags.id],
    }),
  }),
);

export const conversationMessageMentionsRelations = relations(
  conversationMessageMentions,
  ({ one }) => ({
    message: one(conversationMessages, {
      fields: [
        conversationMessageMentions.workspaceId,
        conversationMessageMentions.conversationMessageId,
      ],
      references: [conversationMessages.workspaceId, conversationMessages.id],
    }),
    principal: one(principal, {
      fields: [
        conversationMessageMentions.workspaceId,
        conversationMessageMentions.principalId,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);

export const conversationMessageReactionsRelations = relations(
  conversationMessageReactions,
  ({ one }) => ({
    message: one(conversationMessages, {
      fields: [
        conversationMessageReactions.workspaceId,
        conversationMessageReactions.conversationMessageId,
      ],
      references: [conversationMessages.workspaceId, conversationMessages.id],
    }),
    principal: one(principal, {
      fields: [
        conversationMessageReactions.workspaceId,
        conversationMessageReactions.principalId,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);

export const conversationMessageFlagsRelations = relations(
  conversationMessageFlags,
  ({ one }) => ({
    message: one(conversationMessages, {
      fields: [
        conversationMessageFlags.workspaceId,
        conversationMessageFlags.conversationMessageId,
      ],
      references: [conversationMessages.workspaceId, conversationMessages.id],
    }),
    principal: one(principal, {
      fields: [
        conversationMessageFlags.workspaceId,
        conversationMessageFlags.principalId,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);

export const conversationMessagesRelations = relations(
  conversationMessages,
  ({ one, many }) => ({
    conversation: one(conversations, {
      fields: [
        conversationMessages.workspaceId,
        conversationMessages.conversationId,
      ],
      references: [conversations.workspaceId, conversations.id],
    }),
    ticket: one(tickets, {
      fields: [conversationMessages.workspaceId, conversationMessages.ticketId],
      references: [tickets.workspaceId, tickets.id],
    }),
    mentions: many(conversationMessageMentions),
    reactions: many(conversationMessageReactions),
    flags: many(conversationMessageFlags),
    translations: many(conversationMessageTranslations),
  }),
);

export const conversationMessageTranslationsRelations = relations(
  conversationMessageTranslations,
  ({ one }) => ({
    message: one(conversationMessages, {
      fields: [
        conversationMessageTranslations.workspaceId,
        conversationMessageTranslations.conversationMessageId,
      ],
      references: [conversationMessages.workspaceId, conversationMessages.id],
    }),
  }),
);
