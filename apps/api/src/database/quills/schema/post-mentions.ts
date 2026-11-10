import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
import { timestamp, uniqueIndex, index, foreignKey } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { posts } from "./posts";
import { principal } from "./auth";

/**
 * Join table: records every @-mention of a principal inside a post body.
 *
 * Used by the post.mentioned notification pipeline and the in-app
 * "mentioned me" feed. Insert-once-per-(post, principal); `notifiedAt`
 * is set when the notification has been delivered so re-edits of the
 * same post don't fire duplicate notifications for the same target.
 */
export const postMentions = quillsSchema
  .table(
    "post_mentions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_mention")("id").notNull(),
      postId: typeIdColumn("post")("post_id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      notifiedAt: timestamp("notified_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      // FK names match the constraints the SQL migration created.
      foreignKey({
        name: "post_mentions_post_id_fkey",
        columns: [t.workspaceId, t.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "post_mentions_principal_id_fkey",
        columns: [t.workspaceId, t.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      uniqueIndex("post_mentions_post_principal_uq").on(
        t.workspaceId,
        t.postId,
        t.principalId,
      ),
      // nullsFirst matches the migration's plain DESC (postgres default).
      index("post_mentions_principal_idx").on(
        t.principalId,
        t.createdAt.desc().nullsFirst(),
      ),
      primaryKey({ columns: [t.workspaceId, t.id] }),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();

export const postMentionsRelations = relations(postMentions, ({ one }) => ({
  post: one(posts, {
    fields: [postMentions.workspaceId, postMentions.postId],
    references: [posts.workspaceId, posts.id],
  }),
  principal: one(principal, {
    fields: [postMentions.workspaceId, postMentions.principalId],
    references: [principal.workspaceId, principal.id],
  }),
}));

export type PostMention = typeof postMentions.$inferSelect;
export type NewPostMention = typeof postMentions.$inferInsert;
