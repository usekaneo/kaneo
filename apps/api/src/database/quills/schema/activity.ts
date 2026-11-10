import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
import { text, timestamp, jsonb, index } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { posts } from "./posts";
import { principal } from "./auth";

/**
 * Post activity log — tracks all meaningful state changes on posts.
 *
 * Each row represents a single activity event: status change, merge, tag update, etc.
 * The principal_id records who performed the action (null for system-initiated actions).
 * Type-specific details are stored in the metadata JSONB column.
 */
export const postActivity = quillsSchema
  .table(
    "post_activity",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_activity")("id").notNull(),
      postId: typeIdColumn("post")("post_id").notNull(),
      principalId: typeIdColumnNullable("principal")("principal_id"),
      type: text("type").notNull(),
      metadata: jsonb("metadata").notNull().default({}),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      index("post_activity_post_id_created_idx").on(t.postId, t.createdAt),
      index("post_activity_type_idx").on(t.type),
      primaryKey({ columns: [t.workspaceId, t.id] }),
      foreignKey({
        columns: [t.workspaceId, t.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [t.workspaceId, t.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();

export const postActivityRelations = relations(postActivity, ({ one }) => ({
  post: one(posts, {
    fields: [postActivity.workspaceId, postActivity.postId],
    references: [posts.workspaceId, posts.id],
    relationName: "postActivity",
  }),
  actor: one(principal, {
    fields: [postActivity.workspaceId, postActivity.principalId],
    references: [principal.workspaceId, principal.id],
    relationName: "activityActor",
  }),
}));
