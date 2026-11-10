import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey, unique } from "drizzle-orm/pg-core";
import { text, timestamp, integer, real, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { posts } from "./posts";

/**
 * Post sentiment analysis results (one-to-one with posts).
 */
export const postSentiment = quillsSchema
  .table(
    "post_sentiment",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("sentiment")("id").notNull(),
      postId: typeIdColumn("post")("post_id").notNull(),
      sentiment: text("sentiment", {
        enum: ["positive", "neutral", "negative"],
      }).notNull(),
      confidence: real("confidence").notNull(),
      model: text("model").notNull(),
      processedAt: timestamp("processed_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      inputTokens: integer("input_tokens"),
      outputTokens: integer("output_tokens"),
    },
    (table) => [
      index("post_sentiment_processed_at_idx").on(table.processedAt),
      index("post_sentiment_sentiment_idx").on(table.sentiment),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      unique().on(table.workspaceId, table.postId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const postSentimentRelations = relations(postSentiment, ({ one }) => ({
  post: one(posts, {
    fields: [postSentiment.workspaceId, postSentiment.postId],
    references: [posts.workspaceId, posts.id],
  }),
}));

export type PostSentiment = typeof postSentiment.$inferSelect;
export type NewPostSentiment = typeof postSentiment.$inferInsert;
