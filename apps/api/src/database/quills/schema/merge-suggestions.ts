import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
import { text, timestamp, real, index, uniqueIndex } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { posts } from "./posts";
import { principal } from "./auth";

export const mergeSuggestions = quillsSchema
  .table(
    "post_merge_suggestions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_merge_sug")("id").notNull(),
      // The smaller post (to be merged away)
      sourcePostId: typeIdColumn("post")("source_post_id").notNull(),
      // The larger canonical post (to keep)
      targetPostId: typeIdColumn("post")("target_post_id").notNull(),
      status: text("status", {
        enum: ["pending", "accepted", "dismissed", "expired"],
      })
        .notNull()
        .default("pending"),
      // Score components
      vectorScore: real("vector_score").notNull(),
      ftsScore: real("fts_score").notNull(),
      hybridScore: real("hybrid_score").notNull(),
      // LLM verification
      llmConfidence: real("llm_confidence").notNull(),
      llmReasoning: text("llm_reasoning"),
      llmModel: text("llm_model"),
      // Resolution
      resolvedAt: timestamp("resolved_at", { withTimezone: true }),
      resolvedByPrincipalId: typeIdColumnNullable("principal")(
        "resolved_by_principal_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      index("post_merge_suggestions_source_post_idx").on(t.sourcePostId),
      index("post_merge_suggestions_target_post_idx").on(t.targetPostId),
      index("post_merge_suggestions_status_idx").on(t.status),
      index("post_merge_suggestions_created_idx").on(t.createdAt),
      // Only one pending suggestion per source+target pair
      uniqueIndex("post_merge_suggestions_pending_unique_idx")
        .on(t.workspaceId, t.sourcePostId, t.targetPostId)
        .where(sql`${t.status} = 'pending'`),
      primaryKey({ columns: [t.workspaceId, t.id] }),
      foreignKey({
        columns: [t.workspaceId, t.sourcePostId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.workspaceId, t.targetPostId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.workspaceId, t.resolvedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();

export const mergeSuggestionsRelations = relations(
  mergeSuggestions,
  ({ one }) => ({
    sourcePost: one(posts, {
      fields: [mergeSuggestions.workspaceId, mergeSuggestions.sourcePostId],
      references: [posts.workspaceId, posts.id],
      relationName: "mergeSuggestionSource",
    }),
    targetPost: one(posts, {
      fields: [mergeSuggestions.workspaceId, mergeSuggestions.targetPostId],
      references: [posts.workspaceId, posts.id],
      relationName: "mergeSuggestionTarget",
    }),
    resolvedBy: one(principal, {
      fields: [
        mergeSuggestions.workspaceId,
        mergeSuggestions.resolvedByPrincipalId,
      ],
      references: [principal.workspaceId, principal.id],
      relationName: "mergeSuggestionResolver",
    }),
  }),
);
