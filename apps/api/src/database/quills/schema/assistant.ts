import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  check,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { conversations } from "./conversation";
import { principal } from "./auth";

/**
 * Assistant involvement record — the audit/KPI unit for the in-product AI
 * agent (Quinn). One row per conversation the assistant engages, carrying how
 * it was triggered, its terminal status, the structured hand-off reason (if
 * any), the sources it cited, and a CSAT rating once the assistant was the last
 * handler. Turn-level detail (tool calls, tokens) lives on message metadata and
 * `ai_usage_log`; this table is the reporting spine.
 */

/** How the assistant came to engage a conversation. */
export const ASSISTANT_INVOLVEMENT_TRIGGERS = [
  "first_touch",
  "workflow",
  "agent_handback",
] as const;

/**
 * Terminal lifecycle of one involvement. `resolved_confirmed` = explicit
 * customer affirmation; `resolved_assumed` = customer inactivity after a real
 * answer. At most one resolution per conversation.
 */
export const ASSISTANT_INVOLVEMENT_STATUSES = [
  "active",
  "handed_off",
  "resolved_confirmed",
  "resolved_assumed",
  "abandoned",
] as const;

/** Structured reasons the MODEL may hand off with (it decides THAT, never WHERE).
 *  This is the canonical model-pickable list; the handoff tool schema derives
 *  from it, so a reason added here reaches the model automatically. */
export const ASSISTANT_MODEL_HANDOFF_REASONS = [
  "explicit_request",
  "frustration",
  "repetition",
  "low_confidence",
  "capability_limit",
  "safety",
] as const;

/** Full storage union: the model-pickable reasons plus the server-assigned
 *  ones, never offered to the model. `system_error` is the failure floor's
 *  reason when a turn dies before the model produced anything;
 *  `awaiting_confirmation` is set when a customer turn filed an action that a
 *  teammate has to confirm. */
export const ASSISTANT_HANDOFF_REASONS = [
  ...ASSISTANT_MODEL_HANDOFF_REASONS,
  "system_error",
  "awaiting_confirmation",
] as const;

export type AssistantInvolvementTrigger =
  (typeof ASSISTANT_INVOLVEMENT_TRIGGERS)[number];
export type AssistantInvolvementStatus =
  (typeof ASSISTANT_INVOLVEMENT_STATUSES)[number];
export type AssistantHandoffReason = (typeof ASSISTANT_HANDOFF_REASONS)[number];

/** One cited source captured on an involvement (a help-center article, a feedback post, an admin-curated snippet, a past-conversation summary, a closed ticket, a changelog entry, an uploaded knowledge document, or an admin-added web page). `type` mirrors ASSISTANT_CITATION_TYPES (apps/web citation-types.ts). */
export interface AssistantInvolvementSource {
  type:
    | "article"
    | "post"
    | "snippet"
    | "summary"
    | "ticket"
    | "changelog"
    | "document"
    | "webpage";
  id: string;
  title?: string;
  url?: string;
}

export const assistantInvolvements = quillsSchema
  .table(
    "assistant_involvements",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("assistant_involvement")("id").notNull(),
      conversationId: typeIdColumn("conversation")("conversation_id").notNull(),
      triggeredBy: text("triggered_by", {
        enum: ASSISTANT_INVOLVEMENT_TRIGGERS,
      }).notNull(),
      status: text("status", { enum: ASSISTANT_INVOLVEMENT_STATUSES })
        .notNull()
        .default("active"),
      handoffReason: text("handoff_reason", {
        enum: ASSISTANT_HANDOFF_REASONS,
      }),
      sources: jsonb("sources")
        .$type<AssistantInvolvementSource[]>()
        .notNull()
        .default([]),
      rating: integer("rating"),
      // When Quinn made its single escalation offer. Its presence is the
      // "already offered" flag: the engine escalates straight to hand-off on a
      // repeat rather than offering a human twice.
      escalationOfferedAt: timestamp("escalation_offered_at", {
        withTimezone: true,
      }),
      // When Quinn last gave a substantive answer. Drives the assumed-resolution
      // inactivity sweep — a quiet thread past the window is resolved as assumed.
      lastAssistantAnswerAt: timestamp("last_assistant_answer_at", {
        withTimezone: true,
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      endedAt: timestamp("ended_at", { withTimezone: true }),
    },
    (t) => [
      index("assistant_involvements_conversation_id_idx").on(t.conversationId),
      // Drives the stale-involvement sweep, which scans active involvements by
      // last-answer time; partial so only active rows are indexed.
      index("assistant_involvements_active_answer_idx")
        .on(t.lastAssistantAnswerAt)
        .where(sql`${t.status} = 'active'`),
      // Drives the Quinn performance dashboard's date-range scan.
      index("assistant_involvements_created_at_idx").on(t.createdAt),
      primaryKey({ columns: [t.workspaceId, t.id] }),
      foreignKey({
        columns: [t.workspaceId, t.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();

export const assistantInvolvementsRelations = relations(
  assistantInvolvements,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [
        assistantInvolvements.workspaceId,
        assistantInvolvements.conversationId,
      ],
      references: [conversations.workspaceId, conversations.id],
    }),
  }),
);

/** pgvector column, 1536 dims (OpenAI text-embedding-3-small). Local to this
 *  file, mirroring the per-schema-file `vector` customType convention (see
 *  posts.ts / kb.ts) rather than a shared export. */
const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
});

/** Mirrors `ContentAudience` (apps/web assistant/audience.ts) — kept as its
 *  own literal array here rather than importing that app-layer type, so this
 *  package stays independent of the web app. */
export const ASSISTANT_SNIPPET_AUDIENCES = [
  "public",
  "team",
  "internal",
] as const;
export type AssistantSnippetAudience =
  (typeof ASSISTANT_SNIPPET_AUDIENCES)[number];

/**
 * Snippets — short, private facts an admin curates for Quinn to ground
 * answers on, alongside the knowledge base and (when enabled) feedback
 * posts. Unlike a guidance rule (which steers HOW Quinn answers), a snippet
 * IS an answerable fact: it is embedded on write and retrieved the same way
 * a KB article is (`assistant/snippets-retrieval.ts`), scoped by its own
 * `audience` ceiling rather than a surface allowlist. No vector index
 * (matches house style: exact scan until corpus size demands one).
 */
export const assistantSnippets = quillsSchema
  .table(
    "assistant_snippets",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("assistant_snippet")("id").notNull(),
      title: text("title").notNull(),
      content: text("content").notNull(),
      audience: text("audience", { enum: ASSISTANT_SNIPPET_AUDIENCES })
        .notNull()
        .default("team"),
      enabled: boolean("enabled").notNull().default(true),
      embedding: vector("embedding"),
      embeddingModel: text("embedding_model"),
      embeddingUpdatedAt: timestamp("embedding_updated_at", {
        withTimezone: true,
      }),
      // Nulled on the author's deletion — the snippet outlives them.
      createdById: typeIdColumnNullable("principal")("created_by_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("assistant_snippets_enabled_audience_idx").on(
        table.enabled,
        table.audience,
      ),
      index("assistant_snippets_embedding_hnsw_idx")
        .using("hnsw", sql`${table.embedding} vector_cosine_ops`)
        .where(sql`${table.embedding} IS NOT NULL`),
      check(
        "assistant_snippets_title_length_check",
        sql`char_length(${table.title}) <= 120`,
      ),
      check(
        "assistant_snippets_content_length_check",
        sql`char_length(${table.content}) <= 2000`,
      ),
      check(
        "assistant_snippets_audience_check",
        sql`${table.audience} IN ('public','team','internal')`,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.createdById],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type AssistantSnippet = typeof assistantSnippets.$inferSelect;

export const assistantSnippetsRelations = relations(
  assistantSnippets,
  ({ one }) => ({
    createdBy: one(principal, {
      fields: [assistantSnippets.workspaceId, assistantSnippets.createdById],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);

/**
 * Knowledge documents — admin-uploaded files (today: PDFs) whose extracted
 * text grounds Quinn's answers, alongside the curated snippets above. Unlike
 * a snippet (a short typed fact), a document is an uploaded artifact: the
 * extracted full text lives in `content` and is embedded on ingest
 * (`assistant/document.service.ts`) for the same hybrid retrieval the
 * changelog source uses (`assistant/documents-retrieval.ts`).
 *
 * Documents are admin-curated customer-answerable content, so every non-
 * deleted row is retrievable at every ceiling — there is no draft state and
 * no audience column. `storageKey` keeps the original bytes in object storage
 * when S3 is configured; it is null when storage is not configured (the
 * extracted text is the grounding source of truth either way).
 */
export const assistantDocuments = quillsSchema
  .table(
    "assistant_documents",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("assistant_document")("id").notNull(),
      title: text("title").notNull(),
      fileName: text("file_name").notNull(),
      mimeType: text("mime_type").notNull(),
      /** Object-storage key of the original upload; null when storage is unconfigured. */
      storageKey: text("storage_key"),
      /** Text extracted from the upload at ingest time; what retrieval grounds on. */
      content: text("content").notNull(),
      embedding: vector("embedding"),
      embeddingModel: text("embedding_model"),
      embeddingUpdatedAt: timestamp("embedding_updated_at", {
        withTimezone: true,
      }),
      // Nulled on the uploader's deletion — the document outlives them.
      createdById: typeIdColumnNullable("principal")("created_by_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      index("assistant_documents_embedding_hnsw_idx")
        .using("hnsw", sql`${table.embedding} vector_cosine_ops`)
        .where(sql`${table.embedding} IS NOT NULL`),
      check(
        "assistant_documents_title_length_check",
        sql`char_length(${table.title}) <= 200`,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.createdById],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type AssistantDocument = typeof assistantDocuments.$inferSelect;

export const assistantDocumentsRelations = relations(
  assistantDocuments,
  ({ one }) => ({
    createdBy: one(principal, {
      fields: [assistantDocuments.workspaceId, assistantDocuments.createdById],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);
