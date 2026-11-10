import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey, unique } from "drizzle-orm/pg-core";
import { text, timestamp, index, customType } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { conversations } from "./conversation";
import { principal } from "./auth";

/** pgvector column, 1536 dims (OpenAI text-embedding-3-small). Local to this
 *  file, mirroring the per-schema-file `vector` customType convention (see
 *  assistant.ts / posts.ts / kb.ts) rather than a shared export. */
const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
});

/**
 * One AI-generated summary per closed conversation (Quinn P2-A.4: past-
 * conversation grounding), produced by `conversation-summary.service.ts` on
 * close from the customer-visible transcript — `assistant.thread.ts` already
 * excludes internal notes, so a note never enters a summary — and embedded
 * for semantic retrieval, mirroring `assistant_snippets`.
 *
 * `visitor_principal_id` is DENORMALIZED from the parent conversation. This
 * is the load-bearing column for `conversation-summary-retrieval.ts`'s
 * mandatory customer-scoping predicate: a grounding query filters on it
 * directly rather than joining back to `conversations`, so the safety check
 * that stops one customer's history leaking into another's answer stays a
 * single indexed equality rather than a join that could be dropped by
 * accident. No vector index (matches house style for this corpus size).
 */
export const conversationSummaries = quillsSchema
  .table(
    "conversation_summaries",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("conversation_summary")("id").notNull(),
      conversationId: typeIdColumn("conversation")("conversation_id").notNull(),
      // Denormalized from conversations.visitorPrincipalId. `restrict` mirrors
      // that column's own FK comment: a principal that owns chat history (and
      // now a summary of it) can never be silently orphaned.
      visitorPrincipalId: typeIdColumn("principal")(
        "visitor_principal_id",
      ).notNull(),
      summary: text("summary").notNull(),
      embedding: vector("embedding"),
      embeddingModel: text("embedding_model"),
      embeddingUpdatedAt: timestamp("embedding_updated_at", {
        withTimezone: true,
      }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("conversation_summaries_visitor_principal_id_idx").on(
        table.visitorPrincipalId,
      ),
      index("conversation_summaries_embedding_hnsw_idx")
        .using("hnsw", sql`${table.embedding} vector_cosine_ops`)
        .where(sql`${table.embedding} IS NOT NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      unique().on(table.workspaceId, table.conversationId),
      foreignKey({
        columns: [table.workspaceId, table.visitorPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("restrict"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type ConversationSummary = typeof conversationSummaries.$inferSelect;

export const conversationSummariesRelations = relations(
  conversationSummaries,
  ({ one }) => ({
    conversation: one(conversations, {
      fields: [
        conversationSummaries.workspaceId,
        conversationSummaries.conversationId,
      ],
      references: [conversations.workspaceId, conversations.id],
    }),
    visitorPrincipal: one(principal, {
      fields: [
        conversationSummaries.workspaceId,
        conversationSummaries.visitorPrincipalId,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);
