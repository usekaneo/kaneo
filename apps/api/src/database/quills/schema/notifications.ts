import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey, unique } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  boolean,
  index,
  uniqueIndex,
  varchar,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { posts, postComments } from "./posts";
import { principal } from "./auth";

/**
 * Per-type x per-channel notification preference overrides.
 * String-keyed by notification type (not the enum) so new notification
 * types never require a schema/migration change here.
 * Kept in sync with NotificationMatrix in
 * apps/web/src/lib/server/domains/subscriptions/notification-matrix.ts.
 */
type NotificationMatrix = Partial<
  Record<string, Partial<Record<"inApp" | "email" | "push", boolean>>>
>;

/**
 * Post subscriptions - tracks which users are subscribed to which posts.
 * Users are auto-subscribed when they create, vote on, or comment on a post.
 *
 * Notification levels controlled by:
 * - notifyComments: receive notifications when someone comments
 * - notifyStatusChanges: receive notifications when status changes
 *
 * "All activity" = both true
 * "Status changes only" = notifyComments=false, notifyStatusChanges=true
 * "Unsubscribed" = row deleted
 */
export const postSubscriptions = quillsSchema
  .table(
    "post_subscriptions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_sub")("id").notNull(),
      postId: typeIdColumn("post")("post_id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      reason: varchar("reason", { length: 20 }).notNull(), // 'author' | 'vote' | 'comment' | 'manual'
      notifyComments: boolean("notify_comments").default(true).notNull(),
      notifyStatusChanges: boolean("notify_status_changes")
        .default(true)
        .notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Unique constraint: one subscription per principal per post
      uniqueIndex("post_subscriptions_unique").on(
        table.workspaceId,
        table.postId,
        table.principalId,
      ),
      index("post_subscriptions_principal_idx").on(table.principalId),
      // Partial index for comment notification lookups
      index("post_subscriptions_post_comments_idx")
        .on(table.postId)
        .where(sql`notify_comments = true`),
      // Partial index for status change notification lookups
      index("post_subscriptions_post_status_idx")
        .on(table.postId)
        .where(sql`notify_status_changes = true`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Notification preferences - per-member email notification settings.
 * Each member has one preferences record.
 */
export const notificationPreferences = quillsSchema
  .table(
    "notification_preferences",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("notif_pref")("id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      emailStatusChange: boolean("email_status_change").default(true).notNull(),
      emailNewComment: boolean("email_new_comment").default(true).notNull(),
      emailMuted: boolean("email_muted").default(false).notNull(),
      // Explicit per-type x per-channel overrides. Nullable with no default -
      // read-time helpers (shouldNotify) supply defaults for absent entries so
      // this column can be introduced without a backfill.
      matrix: jsonb("matrix").$type<NotificationMatrix>(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      unique().on(table.workspaceId, table.principalId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Unsubscribe tokens - one-time tokens for email unsubscribe links.
 * Tokens expire after 30 days and are invalidated after use.
 */
export const unsubscribeTokens = quillsSchema
  .table(
    "unsubscribe_tokens",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("unsub_token")("id").notNull(),
      token: text("token").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      postId: typeIdColumnNullable("post")("post_id"), // null = global unsubscribe
      action: varchar("action", { length: 30 }).notNull(), // 'unsubscribe_post' | 'unsubscribe_all' | 'mute_post'
      expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
      usedAt: timestamp("used_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Note: unsubscribe_tokens_token_unique constraint already provides the index; no separate index needed
      index("unsubscribe_tokens_principal_idx").on(table.principalId),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.token),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// Relations
export const postSubscriptionsRelations = relations(
  postSubscriptions,
  ({ one }) => ({
    post: one(posts, {
      fields: [postSubscriptions.workspaceId, postSubscriptions.postId],
      references: [posts.workspaceId, posts.id],
    }),
    principal: one(principal, {
      fields: [postSubscriptions.workspaceId, postSubscriptions.principalId],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);

export const notificationPreferencesRelations = relations(
  notificationPreferences,
  ({ one }) => ({
    principal: one(principal, {
      fields: [
        notificationPreferences.workspaceId,
        notificationPreferences.principalId,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);

export const unsubscribeTokensRelations = relations(
  unsubscribeTokens,
  ({ one }) => ({
    principal: one(principal, {
      fields: [unsubscribeTokens.workspaceId, unsubscribeTokens.principalId],
      references: [principal.workspaceId, principal.id],
    }),
    post: one(posts, {
      fields: [unsubscribeTokens.workspaceId, unsubscribeTokens.postId],
      references: [posts.workspaceId, posts.id],
    }),
  }),
);

/**
 * In-app notifications - tracks notifications displayed in the UI.
 * Created when events occur (status changes, comments, etc.) for subscribed users.
 */
export const inAppNotifications = quillsSchema
  .table(
    "in_app_notifications",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("notification")("id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      type: varchar("type", { length: 50 }).notNull(), // 'post_status_changed', 'comment_created'
      title: varchar("title", { length: 255 }).notNull(),
      body: text("body"),
      postId: typeIdColumnNullable("post")("post_id"),
      commentId: typeIdColumnNullable("post_comment")("comment_id"),
      metadata: jsonb("metadata").$type<Record<string, unknown>>(),
      readAt: timestamp("read_at", { withTimezone: true }),
      archivedAt: timestamp("archived_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Primary lookup: member's notifications ordered by date
      index("in_app_notifications_principal_created_idx").on(
        table.principalId,
        table.createdAt,
      ),
      // Unread notifications for badge count (partial index)
      index("in_app_notifications_principal_unread_idx")
        .on(table.principalId)
        .where(sql`read_at IS NULL AND archived_at IS NULL`),
      // Find notifications by related post
      index("in_app_notifications_post_idx").on(table.postId),
      // FK RI lookup when a comment is deleted; partial because most
      // notifications don't reference a comment.
      index("in_app_notifications_comment_idx")
        .on(table.commentId)
        .where(sql`"comment_id" IS NOT NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.commentId],
        foreignColumns: [postComments.workspaceId, postComments.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const inAppNotificationsRelations = relations(
  inAppNotifications,
  ({ one }) => ({
    principal: one(principal, {
      fields: [inAppNotifications.workspaceId, inAppNotifications.principalId],
      references: [principal.workspaceId, principal.id],
    }),
    post: one(posts, {
      fields: [inAppNotifications.workspaceId, inAppNotifications.postId],
      references: [posts.workspaceId, posts.id],
    }),
    comment: one(postComments, {
      fields: [inAppNotifications.workspaceId, inAppNotifications.commentId],
      references: [postComments.workspaceId, postComments.id],
    }),
  }),
);
