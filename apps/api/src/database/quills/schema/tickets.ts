import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { unique } from "drizzle-orm/pg-core";
/**
 * Tickets — the durable, trackable support object (support platform §4.2). A
 * ticket is a peer to a conversation, not a wrapper around it: conversations
 * carry the message thread, tickets carry the tracked work (status, assignee,
 * SLA timestamps) and link to conversations through `ticket_conversations`.
 *
 * THE SHARED-THREAD RULE (convergence, scratchpad/convergence-design.md): a
 * CUSTOMER ticket SHARES its linked conversation's thread — the pair is 1:1
 * (the two partial unique indexes on `ticket_conversations` below) and its
 * customer-visible thread is the read-path UNION of the conversation's
 * messages and the ticket's own `ticket_id` rows (both parents live in
 * `conversation_messages`, strictly XOR — see conversation.ts). All new
 * customer-visible writes land on the conversation, and migration 0218
 * (convergence Phase 6 — literal convergence) re-parented every legacy
 * pre-convergence customer-visible row the same way: post-0218,
 * customer-visible messages are conversation-parented ALWAYS; ticket-scoped
 * messages on a customer ticket are internal notes (team-only). The one
 * customer-visible exception is the inert legacy edge 0218 deliberately
 * skipped (standalone customer tickets with no requester, or soft-deleted),
 * which the union loader keeps reading forever. Back-office and tracker
 * tickets keep their own ticket-scoped thread; they link to a conversation as
 * PROVENANCE only (the one they were opened from), which shares no thread —
 * their notes are copied onto it, not re-parented.
 *
 * Three kinds share one table (`type`): a `customer` ticket is the
 * customer-visible request (at most one per conversation); a `back_office`
 * ticket is an internal task; a `tracker` is an umbrella that fans work out to
 * other tickets via `ticket_links`. Scoped to the workspace by the database
 * connection (database-per-workspace); no workspace column.
 */
import {
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  bigserial,
  index,
  uniqueIndex,
  foreignKey,
  primaryKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import { teams } from "./teams";
import { companies } from "./companies";
import { conversations } from "./conversation";
import { ticketTypes } from "./ticket-types";
import {
  CONVERSATION_PRIORITIES,
  TICKET_TYPES,
  TICKET_STATUS_CATEGORIES,
  TICKET_STAGES,
  type TicketStatusCategory,
  type TicketStage,
} from "../types";

/**
 * Customizable ticket statuses (mirrors post_statuses). Each status rolls up to
 * a coarse `category` for reporting and projects to a requester-facing
 * `public_stage`; a NULL `public_stage` hides the status from the requester so
 * internal states (e.g. "Won't do") never leak. Soft-deleted so a removed
 * status keeps its restrict-guarded ticket history.
 */
export const ticketStatuses = quillsSchema
  .table(
    "ticket_statuses",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("ticket_status")("id").notNull(),
      name: text("name").notNull(),
      slug: text("slug").notNull(),
      color: text("color").notNull().default("#6b7280"),
      category: text("category", { enum: TICKET_STATUS_CATEGORIES })
        .notNull()
        .default("open"),
      position: integer("position").notNull().default(0),
      isDefault: boolean("is_default").notNull().default(false),
      // Requester-facing stage this status projects to. NULL = hidden from the
      // requester (the status is internal-only).
      publicStage: text("public_stage", { enum: TICKET_STAGES }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      // Soft delete support.
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      // slug uniqueness is covered by the ticket_statuses_slug_unique constraint.
      index("ticket_statuses_position_idx").on(table.category, table.position),
      index("ticket_statuses_deleted_at_idx").on(table.deletedAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.slug),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const tickets = quillsSchema
  .table(
    "tickets",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("ticket")("id").notNull(),
      // Human-facing sequential id (e.g. #1042) for URLs and references. bigserial
      // is inherently NOT NULL; the unique index enforces no two tickets share one.
      number: bigserial("number", { mode: "number" }),
      type: text("type", { enum: TICKET_TYPES }).notNull().default("customer"),
      // The workspace-defined type (convergence Phase 4, see ticket-types.ts).
      // `type` (the category) is derived from it at write time; nullable because
      // legacy rows predate the registry and archived types stay on history.
      // `set null` is the hard-delete escape hatch only — the service archives.
      ticketTypeId: typeIdColumnNullable("ticket_type")("ticket_type_id"),
      title: text("title").notNull(),
      statusId: typeIdColumn("ticket_status")("status_id").notNull(),
      // Reuses the conversation priority scale. 'none' = unset (the default).
      priority: text("priority", { enum: CONVERSATION_PRIORITIES })
        .notNull()
        .default("none"),
      // The person the ticket is for. `set null` so a removed principal leaves the
      // ticket requester-less rather than orphaned.
      requesterPrincipalId: typeIdColumnNullable("principal")(
        "requester_principal_id",
      ),
      // The teammate handling the ticket (nullable: an open ticket may be
      // unassigned). Independent of the team assignee, mirroring conversations.
      assigneePrincipalId: typeIdColumnNullable("principal")(
        "assignee_principal_id",
      ),
      assigneeTeamId: typeIdColumnNullable("team")("assignee_team_id"),
      // B2B company context (plan / MRR) shown inline; `set null` on delete.
      companyId: typeIdColumnNullable("company")("company_id"),
      // Extensible per-ticket custom fields; empty object by default.
      customAttributes: jsonb("custom_attributes")
        .$type<Record<string, unknown>>()
        .notNull()
        .default({}),
      // SLA + lifecycle timestamps. first_response_at is the first agent reply;
      // waiting_since is when the requester started waiting (drives waiting sorts);
      // due_at is the SLA target; resolved_at is set on close, cleared on reopen.
      firstResponseAt: timestamp("first_response_at", { withTimezone: true }),
      waitingSince: timestamp("waiting_since", { withTimezone: true }),
      dueAt: timestamp("due_at", { withTimezone: true }),
      resolvedAt: timestamp("resolved_at", { withTimezone: true }),
      // How many times the ticket has been reopened after resolution.
      reopenedCount: integer("reopened_count").notNull().default(0),
      // Read receipts power unread badges on each side independently, mirroring
      // conversations.visitorLastReadAt/agentLastReadAt.
      //
      // LEGACY-READ ONLY for customer tickets (convergence Phase 3,
      // scratchpad/convergence-design.md): a conversation-linked customer
      // ticket's unread truth is the CONVERSATION's watermark pair — nothing
      // writes these columns for a linked pair, and any pre-link values stay
      // frozen forever. Post-0218 (Phase 6) every requester-holding customer
      // ticket is a pair, so the only standalone customer tickets left are the
      // inert no-requester legacy edge; the columns stay fully live for
      // back-office/tracker tickets, which kept their own ticket-scoped
      // threads. No column drop, no migration.
      requesterLastReadAt: timestamp("requester_last_read_at", {
        withTimezone: true,
      }),
      assigneeLastReadAt: timestamp("assignee_last_read_at", {
        withTimezone: true,
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
      // The one active SLA applied to this ticket (mirrors
      // conversations.sla_applied; the TTR clock only — FRT/NRT/TTC stay
      // conversation-side), or null. ticket-sla.service.ts owns the shape.
      slaApplied: jsonb("sla_applied").$type<Record<string, unknown>>(),
      // Soft delete; set-null'd actor history survives.
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      // FK names match the constraints the SQL migration created.
      // restrict: a status in use can never be deleted out from under its tickets.
      foreignKey({
        name: "tickets_status_id_fkey",
        columns: [table.workspaceId, table.statusId],
        foreignColumns: [ticketStatuses.workspaceId, ticketStatuses.id],
      }).onDelete("restrict"),
      foreignKey({
        name: "tickets_requester_principal_id_fkey",
        columns: [table.workspaceId, table.requesterPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      foreignKey({
        name: "tickets_assignee_principal_id_fkey",
        columns: [table.workspaceId, table.assigneePrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      foreignKey({
        name: "tickets_assignee_team_id_fkey",
        columns: [table.workspaceId, table.assigneeTeamId],
        foreignColumns: [teams.workspaceId, teams.id],
      }).onDelete("set null"),
      foreignKey({
        name: "tickets_company_id_fkey",
        columns: [table.workspaceId, table.companyId],
        foreignColumns: [companies.workspaceId, companies.id],
      }).onDelete("set null"),
      // set null: a hard-deleted type leaves the ticket typeless (legacy shape)
      // rather than orphaned. The service archives instead of deleting, so this
      // only fires on the escape hatch.
      foreignKey({
        name: "tickets_ticket_type_id_fkey",
        columns: [table.workspaceId, table.ticketTypeId],
        foreignColumns: [ticketTypes.workspaceId, ticketTypes.id],
      }).onDelete("set null"),
      // Ticket #N lookups + the sequence guarantee.
      uniqueIndex("tickets_number_uq").on(table.workspaceId, table.number),
      index("tickets_status_id_idx").on(table.statusId),
      index("tickets_assignee_principal_id_idx").on(table.assigneePrincipalId),
      // Team-inbox filter; partial because most tickets have no team assignee.
      index("tickets_assignee_team_idx")
        .on(table.assigneeTeamId)
        .where(sql`"assignee_team_id" IS NOT NULL`),
      index("tickets_requester_principal_id_idx").on(
        table.requesterPrincipalId,
      ),
      index("tickets_company_id_idx").on(table.companyId),
      // Type-scoped status boards (e.g. all open customer tickets).
      index("tickets_type_status_id_idx").on(table.type, table.statusId),
      // Registry-type filter for the inbox tickets branch (Phase 4).
      index("tickets_ticket_type_id_idx").on(table.ticketTypeId),
      // Keyset support for the unified inbox's cross-status feed (§3.3), mirroring
      // conversations_last_message_at_id_idx. nullsFirst matches the migration's
      // plain DESC (postgres default).
      index("tickets_updated_at_id_idx").on(
        table.updatedAt.desc().nullsFirst(),
        table.id,
      ),
      // Keyset support for the 'created' saved-view sort: createdAt DESC
      // (newest first), the same convention as tickets_updated_at_id_idx above
      // — 'created' is not an oldest-first exception. Declared ascending here
      // (no .desc()) rather than matching conversations_created_at_id_idx's
      // explicit .desc(): Postgres serves the DESC/DESC keyset scan via a
      // backward scan of this ascending (createdAt, id) index just as well.
      index("tickets_created_at_id_idx").on(table.createdAt, table.id),
      // Ticket SLA sweep candidate set — mirrors conversations_sla_unsettled_idx
      // (0187): the predicate selects stamps with an UNSETTLED TTR clock, not
      // just any stamp, so selectivity doesn't degrade as settled tickets
      // accumulate. The sweep repeats this exact clause top-level so the
      // planner proves the index applies.
      // Workspace search by title (0309); same expression as ticketFtsMatch.
      index("tickets_title_search_idx").using(
        "gin",
        sql`to_tsvector('english', ${table.title})`,
      ),
      // Workspace search: a title containing the query anywhere inside (0309).
      index("tickets_title_trgm_idx").using(
        "gin",
        table.title.op("gin_trgm_ops"),
      ),
      index("tickets_sla_unsettled_idx")
        .on(table.id)
        .where(
          sql`${table.slaApplied} IS NOT NULL AND (${table.slaApplied} ->> 'resolvedAt') IS NULL`,
        ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Soft link between a ticket and a conversation (support platform §4.2). A
 * conversation can back several tickets, so this is a join, not an FK on either
 * table — but on the CUSTOMER side the pair is 1:1 (convergence Phase 0,
 * scratchpad/convergence-design.md): one customer ticket per conversation AND
 * one conversation per customer ticket, enforced by the two partial unique
 * indexes below. `ticket_type` is denormalized from tickets.type at link time
 * so both rules are partial unique indexes here without a join. Both sides
 * cascade: deleting a ticket or conversation removes the link.
 */
export const ticketConversations = quillsSchema
  .table(
    "ticket_conversations",
    {
      workspaceId: workspaceColumn(),
      ticketId: typeIdColumn("ticket")("ticket_id").notNull(),
      conversationId: typeIdColumn("conversation")("conversation_id").notNull(),
      // Denormalized from tickets.type at link time; drives the customer-uniqueness
      // partial index below.
      ticketType: text("ticket_type", { enum: TICKET_TYPES }).notNull(),
      linkedByPrincipalId: typeIdColumnNullable("principal")(
        "linked_by_principal_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Composite PK columns listed alphabetically: drizzle-kit introspects them in
      // that order. The real key order is (ticket_id, conversation_id) in the migration.
      primaryKey({
        name: "ticket_conversations_pkey",
        columns: [table.workspaceId, table.conversationId, table.ticketId],
      }),
      foreignKey({
        name: "ticket_conversations_ticket_id_fkey",
        columns: [table.workspaceId, table.ticketId],
        foreignColumns: [tickets.workspaceId, tickets.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "ticket_conversations_conversation_id_fkey",
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "ticket_conversations_linked_by_principal_id_fkey",
        columns: [table.workspaceId, table.linkedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      // Conversation -> tickets reverse lookup (the PK leads with ticket_id).
      index("ticket_conversations_conversation_idx").on(table.conversationId),
      // At most one CUSTOMER ticket per conversation. Partial so back-office and
      // tracker links never collide.
      uniqueIndex("ticket_conversations_customer_uq")
        .on(table.workspaceId, table.conversationId)
        .where(sql`ticket_type = 'customer'`),
      // The mirror image (0214, convergence Phase 0): at most one conversation
      // per CUSTOMER ticket, so the pair is 1:1 and the pair-thread union loader
      // resolves "the pair" from either side. Same partial shape.
      uniqueIndex("ticket_conversations_customer_ticket_uq")
        .on(table.workspaceId, table.ticketId)
        .where(sql`ticket_type = 'customer'`),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Tracker cascade links (support platform §4.2): a `tracker` ticket points at
 * the tickets it fans work out to. `relation` defaults to 'tracks'; the partial
 * unique index makes a linked ticket trackable by at most one tracker while
 * leaving room for other relation kinds later. Both sides cascade to tickets.
 */
export const ticketLinks = quillsSchema
  .table(
    "ticket_links",
    {
      workspaceId: workspaceColumn(),
      trackerTicketId: typeIdColumn("ticket")("tracker_ticket_id").notNull(),
      linkedTicketId: typeIdColumn("ticket")("linked_ticket_id").notNull(),
      relation: text("relation").notNull().default("tracks"),
      linkedByPrincipalId: typeIdColumnNullable("principal")(
        "linked_by_principal_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Composite PK columns listed alphabetically to match introspection. The real
      // key order is (tracker_ticket_id, linked_ticket_id) in the migration.
      primaryKey({
        name: "ticket_links_pkey",
        columns: [
          table.workspaceId,
          table.linkedTicketId,
          table.trackerTicketId,
        ],
      }),
      foreignKey({
        name: "ticket_links_tracker_ticket_id_fkey",
        columns: [table.workspaceId, table.trackerTicketId],
        foreignColumns: [tickets.workspaceId, tickets.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "ticket_links_linked_ticket_id_fkey",
        columns: [table.workspaceId, table.linkedTicketId],
        foreignColumns: [tickets.workspaceId, tickets.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "ticket_links_linked_by_principal_id_fkey",
        columns: [table.workspaceId, table.linkedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      // Tracker -> linked reverse lookup (the PK leads with tracker_ticket_id).
      index("ticket_links_linked_ticket_idx").on(table.linkedTicketId),
      // A linked ticket is tracked by at most one tracker (partial: 'tracks' only).
      uniqueIndex("ticket_links_tracks_uq")
        .on(table.workspaceId, table.linkedTicketId)
        .where(sql`relation = 'tracks'`),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Default ticket statuses seeded for new workspaces (mirrors DEFAULT_STATUSES).
 * No id — the column default generates it. `publicStage: null` marks a status
 * hidden from the requester.
 */
export const DEFAULT_TICKET_STATUSES: Array<{
  name: string;
  slug: string;
  color: string;
  category: TicketStatusCategory;
  position: number;
  isDefault: boolean;
  publicStage: TicketStage | null;
}> = [
  {
    name: "New",
    slug: "new",
    color: "#3b82f6",
    category: "open",
    position: 0,
    isDefault: true,
    publicStage: "received",
  },
  {
    name: "Investigating",
    slug: "investigating",
    color: "#eab308",
    category: "open",
    position: 1,
    isDefault: false,
    publicStage: "in_progress",
  },
  {
    name: "Escalated",
    slug: "escalated",
    color: "#f97316",
    category: "open",
    position: 2,
    isDefault: false,
    publicStage: "in_progress",
  },
  {
    name: "Waiting on customer",
    slug: "waiting_customer",
    color: "#a855f7",
    category: "pending",
    position: 3,
    isDefault: false,
    publicStage: "awaiting_requester",
  },
  {
    name: "Waiting on third party",
    slug: "waiting_third_party",
    color: "#8b5cf6",
    category: "pending",
    position: 4,
    isDefault: false,
    publicStage: "in_progress",
  },
  {
    name: "Resolved",
    slug: "resolved",
    color: "#22c55e",
    category: "closed",
    position: 5,
    isDefault: false,
    publicStage: "resolved",
  },
  {
    name: "Won't do",
    slug: "wont_do",
    color: "#6b7280",
    category: "closed",
    position: 6,
    isDefault: false,
    publicStage: null,
  },
  {
    name: "Duplicate",
    slug: "duplicate",
    color: "#6b7280",
    category: "closed",
    position: 7,
    isDefault: false,
    publicStage: null,
  },
];

export const ticketStatusesRelations = relations(
  ticketStatuses,
  ({ many }) => ({
    tickets: many(tickets),
  }),
);

export const ticketsRelations = relations(tickets, ({ one, many }) => ({
  status: one(ticketStatuses, {
    fields: [tickets.workspaceId, tickets.statusId],
    references: [ticketStatuses.workspaceId, ticketStatuses.id],
  }),
  ticketType: one(ticketTypes, {
    fields: [tickets.workspaceId, tickets.ticketTypeId],
    references: [ticketTypes.workspaceId, ticketTypes.id],
  }),
  company: one(companies, {
    fields: [tickets.workspaceId, tickets.companyId],
    references: [companies.workspaceId, companies.id],
  }),
  requester: one(principal, {
    fields: [tickets.workspaceId, tickets.requesterPrincipalId],
    references: [principal.workspaceId, principal.id],
    relationName: "ticketRequester",
  }),
  assignee: one(principal, {
    fields: [tickets.workspaceId, tickets.assigneePrincipalId],
    references: [principal.workspaceId, principal.id],
    relationName: "ticketAssignee",
  }),
  conversations: many(ticketConversations),
}));

export const ticketConversationsRelations = relations(
  ticketConversations,
  ({ one }) => ({
    ticket: one(tickets, {
      fields: [ticketConversations.workspaceId, ticketConversations.ticketId],
      references: [tickets.workspaceId, tickets.id],
    }),
    conversation: one(conversations, {
      fields: [
        ticketConversations.workspaceId,
        ticketConversations.conversationId,
      ],
      references: [conversations.workspaceId, conversations.id],
    }),
  }),
);

export const ticketLinksRelations = relations(ticketLinks, ({ one }) => ({
  trackerTicket: one(tickets, {
    fields: [ticketLinks.workspaceId, ticketLinks.trackerTicketId],
    references: [tickets.workspaceId, tickets.id],
    relationName: "ticketTracker",
  }),
  linkedTicket: one(tickets, {
    fields: [ticketLinks.workspaceId, ticketLinks.linkedTicketId],
    references: [tickets.workspaceId, tickets.id],
    relationName: "ticketLinked",
  }),
}));
