import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  integer,
  boolean,
  index,
  uniqueIndex,
  jsonb,
  customType,
  check,
  varchar,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { boards, postTags } from "./boards";
import { postStatuses } from "./statuses";
import { postExternalLinks } from "./external-links";
import { principal } from "./auth";
import { MODERATION_STATES } from "../types";
import type { CustomFieldValues, TiptapContent } from "../types";

// Custom tsvector type for full-text search
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

// Custom vector type for embeddings (pgvector)
// 1536 dimensions = OpenAI text-embedding-3-small
const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
});

export const posts = quillsSchema
  .table(
    "posts",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post")("id").notNull(),
      boardId: typeIdColumn("board")("board_id").notNull(),
      title: text("title").notNull(),
      content: text("content").notNull(),
      // Rich content stored as TipTap JSON (optional, for rich text support)
      contentJson: jsonb("content_json").$type<TiptapContent>(),
      // Principal-scoped identity - every post has an author
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      // Status reference to post_statuses table
      statusId: typeIdColumn("post_status")("status_id"),
      // Owner is also principal-scoped (team member assigned to this post)
      ownerPrincipalId: typeIdColumnNullable("principal")("owner_principal_id"),
      // Team member who tracked this post from a support conversation on the
      // customer's behalf. The author (principalId) stays the customer.
      trackedByPrincipalId: typeIdColumnNullable("principal")(
        "tracked_by_principal_id",
      ),
      voteCount: integer("vote_count").default(0).notNull(),
      // Denormalized comment count for performance
      // Maintained by application code in comment.service.ts (create/delete operations)
      commentCount: integer("comment_count").default(0).notNull(),
      // Pinned comment as official response
      // References a team member's root-level comment that serves as the official response
      pinnedCommentId:
        typeIdColumnNullable("post_comment")("pinned_comment_id"),
      // Board pinning: set posts lead their public board listing under every
      // sort, most recently pinned first. Null means unpinned.
      pinnedAt: timestamp("pinned_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      // Soft delete support
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
      deletedByPrincipalId: typeIdColumnNullable("principal")(
        "deleted_by_principal_id",
      ),
      // Lock thread: prevent portal users from commenting (team members can still comment)
      isCommentsLocked: boolean("is_comments_locked").default(false).notNull(),
      // Moderation state for imported/pending content
      moderationState: text("moderation_state", {
        enum: MODERATION_STATES,
      })
        .default("published")
        .notNull(),
      // Key-value metadata attached by the widget SDK
      widgetMetadata: jsonb("widget_metadata").$type<Record<string, string>>(),
      // Validated answers to the board's configured custom fields
      // (boards.settings.customFields), keyed by field key. Null when the board
      // configures no fields.
      customFieldValues: jsonb(
        "custom_field_values",
      ).$type<CustomFieldValues>(),
      // Merge/deduplication: points to the canonical post this was merged into
      canonicalPostId: typeIdColumnNullable("post")("canonical_post_id"),
      mergedAt: timestamp("merged_at", { withTimezone: true }),
      mergedByPrincipalId: typeIdColumnNullable("principal")(
        "merged_by_principal_id",
      ),
      // Full-text search vector (generated column, auto-computed from title and content)
      // Title has weight 'A' (highest), content has weight 'B'
      searchVector: tsvector("search_vector").generatedAlwaysAs(
        sql`setweight(to_tsvector('english', coalesce(title, '')), 'A') || setweight(to_tsvector('english', coalesce(content, '')), 'B')`,
      ),
      // Semantic embedding for AI-powered similarity search (1536 dims = OpenAI text-embedding-3-small)
      embedding: vector("embedding"),
      // Track model version for future upgrades (allows re-embedding without data loss)
      embeddingModel: text("embedding_model"),
      embeddingUpdatedAt: timestamp("embedding_updated_at", {
        withTimezone: true,
      }),
      // AI-generated post summary (structured JSON for PM triage)
      summaryJson: jsonb("summary_json").$type<{
        summary: string;
        keyQuotes: string[];
        nextSteps: string[];
      }>(),
      summaryModel: text("summary_model"),
      summaryUpdatedAt: timestamp("summary_updated_at", { withTimezone: true }),
      summaryCommentCount: integer("summary_comment_count"),
      // Merge suggestion staleness tracking
      mergeCheckedAt: timestamp("merge_checked_at", { withTimezone: true }),
      // Nullable target ship date for time-based roadmap columns. Stored as a full
      // timestamp (single-datetime ETA model); presented at month granularity.
      eta: timestamp("eta", { withTimezone: true }),
    },
    (table) => [
      // Named to match the constraint the SQL migration created.
      foreignKey({
        name: "posts_tracked_by_principal_id_fk",
        columns: [table.workspaceId, table.trackedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      index("posts_status_id_idx").on(table.statusId),
      index("posts_owner_principal_id_idx").on(table.ownerPrincipalId),
      // Partial indexes on mostly-null audit columns: never filtered on directly,
      // but principal deletion RI-checks them per referencing table.
      index("posts_deleted_by_principal_idx")
        .on(table.deletedByPrincipalId)
        .where(sql`"deleted_by_principal_id" IS NOT NULL`),
      index("posts_merged_by_principal_idx")
        .on(table.mergedByPrincipalId)
        .where(sql`"merged_by_principal_id" IS NOT NULL`),
      index("posts_tracked_by_principal_id_idx").on(table.trackedByPrincipalId),
      index("posts_created_at_idx").on(table.createdAt),
      index("posts_vote_count_idx").on(table.voteCount),
      index("posts_embedding_hnsw_idx")
        .using("hnsw", sql`${table.embedding} vector_cosine_ops`)
        .where(sql`${table.embedding} IS NOT NULL`),
      // Composite indexes for post listings sorted by "top" and "new"
      index("posts_board_vote_idx").on(table.boardId, table.voteCount),
      index("posts_board_created_at_idx").on(table.boardId, table.createdAt),
      // Composite index for admin inbox filtering by status
      index("posts_board_status_idx").on(table.boardId, table.statusId),
      // Composite index for user activity pages (posts by author)
      index("posts_principal_created_at_idx").on(
        table.principalId,
        table.createdAt,
      ),
      // Partial index for roadmap posts (only posts with status)
      index("posts_with_status_idx")
        .on(table.statusId, table.voteCount)
        .where(sql`status_id IS NOT NULL`),
      // GIN index for full-text search
      index("posts_search_vector_idx").using("gin", table.searchVector),
      // Trigram index for search's close-spelling fallback (`words <% title`).
      // Built CONCURRENTLY after migrations (CONCURRENT_INDEX_SPECS).
      index("posts_title_trgm_idx")
        .using("gin", sql`${table.title} gin_trgm_ops`)
        .where(sql`${table.deletedAt} IS NULL`),
      // Index for filtering deleted posts
      index("posts_deleted_at_idx").on(table.deletedAt),
      // Composite index for soft-delete queries (e.g., active posts by board)
      index("posts_board_deleted_at_idx").on(table.boardId, table.deletedAt),
      // Index for moderation state filtering
      index("posts_moderation_state_idx").on(table.moderationState),
      // Index for pinned comment lookups
      index("posts_pinned_comment_id_idx").on(table.pinnedCommentId),
      // Index for finding merged/duplicate posts by canonical post
      index("posts_canonical_post_id_idx").on(table.canonicalPostId),
      // Partial index for time-based roadmap bucketing (only posts with an ETA).
      index("posts_eta_idx")
        .on(table.eta)
        .where(sql`"eta" IS NOT NULL`),
      // CHECK constraints to ensure counts are never negative
      check("vote_count_non_negative", sql`vote_count >= 0`),
      check("comment_count_non_negative", sql`comment_count >= 0`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.boardId],
        foreignColumns: [boards.workspaceId, boards.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("restrict"),
      foreignKey({
        columns: [table.workspaceId, table.statusId],
        foreignColumns: [postStatuses.workspaceId, postStatuses.id],
      }).onDelete("set null"),
      foreignKey({
        columns: [table.workspaceId, table.ownerPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      foreignKey({
        columns: [table.workspaceId, table.deletedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      foreignKey({
        columns: [table.workspaceId, table.mergedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const postTagAssignments = quillsSchema
  .table(
    "post_tag_assignments",
    {
      workspaceId: workspaceColumn(),
      postId: typeIdColumn("post")("post_id").notNull(),
      tagId: typeIdColumn("post_tag")("tag_id").notNull(),
      // AI-applied marker: true when the auto-tagging engine (not a human)
      // attached the tag, so admins can review AI-applied tags.
      autoTagged: boolean("auto_tagged").default(false).notNull(),
    },
    (table) => [
      // FK names predate the post_tags -> post_tag_assignments table rename.
      foreignKey({
        name: "post_tags_post_id_posts_id_fk",
        columns: [table.workspaceId, table.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "post_tags_tag_id_tags_id_fk",
        columns: [table.workspaceId, table.tagId],
        foreignColumns: [postTags.workspaceId, postTags.id],
      }).onDelete("cascade"),
      uniqueIndex("post_tag_assignments_pk").on(
        table.workspaceId,
        table.postId,
        table.tagId,
      ),
      index("post_tag_assignments_tag_id_idx").on(table.tagId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const postVotes = quillsSchema
  .table(
    "post_votes",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_vote")("id").notNull(),
      postId: typeIdColumn("post")("post_id").notNull(),
      // principal_id is required - only authenticated users can vote
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      // Source tracking for integration-created votes (e.g. Zendesk sidebar)
      sourceType: varchar("source_type", { length: 40 }),
      sourceExternalUrl: text("source_external_url"),
      // Which admin/member added this vote on behalf of the voter
      addedByPrincipalId: typeIdColumnNullable("principal")(
        "added_by_principal_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Named to match the constraint the SQL migration created.
      foreignKey({
        name: "post_votes_added_by_principal_id_fkey",
        columns: [table.workspaceId, table.addedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      // Unique constraint: one vote per principal per post
      uniqueIndex("post_votes_principal_post_idx").on(
        table.workspaceId,
        table.postId,
        table.principalId,
      ),
      index("post_votes_principal_created_at_idx").on(
        table.principalId,
        table.createdAt,
      ),
      // Partial index for finding integration-sourced votes
      index("post_votes_source_type_idx")
        .on(table.sourceType)
        .where(sql`source_type IS NOT NULL`),
      // RI-lookup protection for principal deletion
      index("post_votes_added_by_principal_idx")
        .on(table.addedByPrincipalId)
        .where(sql`"added_by_principal_id" IS NOT NULL`),
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

export const postComments = quillsSchema
  .table(
    "post_comments",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_comment")("id").notNull(),
      postId: typeIdColumn("post")("post_id").notNull(),
      parentId: typeIdColumn("post_comment")("parent_id"),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      content: text("content").notNull(),
      contentJson: jsonb("content_json").$type<TiptapContent>(),
      isTeamMember: boolean("is_team_member").default(false).notNull(),
      isPrivate: boolean("is_private").default(false).notNull(),
      // Status change tracking: records which status transition occurred with this comment
      statusChangeFromId: typeIdColumnNullable("post_status")(
        "status_change_from_id",
      ),
      statusChangeToId: typeIdColumnNullable("post_status")(
        "status_change_to_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true }),
      // Soft delete support
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
      // Who initiated the deletion (self-delete vs team-removed)
      deletedByPrincipalId: typeIdColumnNullable("principal")(
        "deleted_by_principal_id",
      ),
      // Moderation state for per-board approval gating
      moderationState: text("moderation_state", {
        enum: MODERATION_STATES,
      })
        .notNull()
        .default("published"),
    },
    (table) => [
      foreignKey({
        name: "post_comments_parent_id_post_comments_id_fk",
        columns: [table.workspaceId, table.parentId],
        foreignColumns: [table.workspaceId, table.id],
      }).onDelete("cascade"),
      index("post_comments_parent_id_idx").on(table.parentId),
      index("post_comments_principal_id_idx").on(table.principalId),
      index("post_comments_created_at_idx").on(table.createdAt),
      // Composite index for comment listings
      index("post_comments_post_created_at_idx").on(
        table.postId,
        table.createdAt,
      ),
      index("post_comments_moderation_state_idx").on(table.moderationState),
      // Partial index for the time-to-resolution analytics query, which joins
      // comments to post_statuses via status_change_to_id. The column is NULL on
      // ordinary comments, so the partial keeps the index to the sparse rows.
      index("post_comments_status_change_to_id_idx")
        .on(table.statusChangeToId)
        .where(sql`status_change_to_id IS NOT NULL`),
      // RI-lookup protection for principal deletion
      index("post_comments_deleted_by_principal_idx")
        .on(table.deletedByPrincipalId)
        .where(sql`"deleted_by_principal_id" IS NOT NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("restrict"),
      foreignKey({
        columns: [table.workspaceId, table.statusChangeFromId],
        foreignColumns: [postStatuses.workspaceId, postStatuses.id],
      }).onDelete("set null"),
      foreignKey({
        columns: [table.workspaceId, table.statusChangeToId],
        foreignColumns: [postStatuses.workspaceId, postStatuses.id],
      }).onDelete("set null"),
      foreignKey({
        columns: [table.workspaceId, table.deletedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const postCommentReactions = quillsSchema
  .table(
    "post_comment_reactions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_comment_reaction")("id").notNull(),
      commentId: typeIdColumn("post_comment")("comment_id").notNull(),
      // principal_id is required - only authenticated users can react
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      emoji: text("emoji").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("post_comment_reactions_principal_id_idx").on(table.principalId),
      uniqueIndex("post_comment_reactions_unique_idx").on(
        table.workspaceId,
        table.commentId,
        table.principalId,
        table.emoji,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.commentId],
        foreignColumns: [postComments.workspaceId, postComments.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// Edit history tables for tracking post and comment changes
export const postEditHistory = quillsSchema
  .table(
    "post_edit_history",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_edit")("id").notNull(),
      postId: typeIdColumn("post")("post_id").notNull(),
      editorPrincipalId: typeIdColumn("principal")(
        "editor_principal_id",
      ).notNull(),
      previousTitle: text("previous_title").notNull(),
      previousContent: text("previous_content").notNull(),
      previousContentJson: jsonb(
        "previous_content_json",
      ).$type<TiptapContent>(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("post_edit_history_post_id_idx").on(table.postId),
      index("post_edit_history_editor_principal_idx").on(
        table.editorPrincipalId,
      ),
      index("post_edit_history_created_at_idx").on(table.createdAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.editorPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const postCommentEditHistory = quillsSchema
  .table(
    "post_comment_edit_history",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_comment_edit")("id").notNull(),
      commentId: typeIdColumn("post_comment")("comment_id").notNull(),
      editorPrincipalId: typeIdColumn("principal")(
        "editor_principal_id",
      ).notNull(),
      previousContent: text("previous_content").notNull(),
      previousContentJson: jsonb(
        "previous_content_json",
      ).$type<TiptapContent>(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("post_comment_edit_history_comment_id_idx").on(table.commentId),
      index("post_comment_edit_history_editor_principal_idx").on(
        table.editorPrincipalId,
      ),
      index("post_comment_edit_history_created_at_idx").on(table.createdAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.commentId],
        foreignColumns: [postComments.workspaceId, postComments.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.editorPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// Internal staff notes on posts (not visible to public users)
export const postNotes = quillsSchema
  .table(
    "post_notes",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_note")("id").notNull(),
      postId: typeIdColumn("post")("post_id").notNull(),
      // Principal who created the note (staff only)
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      content: text("content").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("post_notes_post_id_idx").on(table.postId),
      index("post_notes_principal_id_idx").on(table.principalId),
      index("post_notes_created_at_idx").on(table.createdAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("restrict"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// Relations
export const postsRelations = relations(posts, ({ one, many }) => ({
  board: one(boards, {
    fields: [posts.workspaceId, posts.boardId],
    references: [boards.workspaceId, boards.id],
  }),
  // Status reference (new customizable status system)
  postStatus: one(postStatuses, {
    fields: [posts.workspaceId, posts.statusId],
    references: [postStatuses.workspaceId, postStatuses.id],
  }),
  // Principal-scoped author (Hub-and-Spoke identity)
  author: one(principal, {
    fields: [posts.workspaceId, posts.principalId],
    references: [principal.workspaceId, principal.id],
    relationName: "postAuthor",
  }),
  // Principal-scoped owner (team member assigned)
  owner: one(principal, {
    fields: [posts.workspaceId, posts.ownerPrincipalId],
    references: [principal.workspaceId, principal.id],
    relationName: "postOwner",
  }),
  // Pinned comment as official response
  pinnedComment: one(postComments, {
    fields: [posts.workspaceId, posts.pinnedCommentId],
    references: [postComments.workspaceId, postComments.id],
  }),
  // Merge/deduplication: the canonical post this was merged into
  canonicalPost: one(posts, {
    fields: [posts.workspaceId, posts.canonicalPostId],
    references: [posts.workspaceId, posts.id],
    relationName: "mergedPosts",
  }),
  // Merge/deduplication: posts that have been merged into this one
  mergedPosts: many(posts, { relationName: "mergedPosts" }),
  // Merge actor
  mergedBy: one(principal, {
    fields: [posts.workspaceId, posts.mergedByPrincipalId],
    references: [principal.workspaceId, principal.id],
    relationName: "postMergedBy",
  }),
  votes: many(postVotes),
  comments: many(postComments),
  tags: many(postTagAssignments),
  notes: many(postNotes),
  externalLinks: many(postExternalLinks),
}));

export const postVotesRelations = relations(postVotes, ({ one }) => ({
  post: one(posts, {
    fields: [postVotes.workspaceId, postVotes.postId],
    references: [posts.workspaceId, posts.id],
  }),
}));

export const postCommentsRelations = relations(
  postComments,
  ({ one, many }) => ({
    post: one(posts, {
      fields: [postComments.workspaceId, postComments.postId],
      references: [posts.workspaceId, posts.id],
    }),
    // Principal-scoped author (Hub-and-Spoke identity)
    author: one(principal, {
      fields: [postComments.workspaceId, postComments.principalId],
      references: [principal.workspaceId, principal.id],
      relationName: "commentAuthor",
    }),
    parent: one(postComments, {
      fields: [postComments.workspaceId, postComments.parentId],
      references: [postComments.workspaceId, postComments.id],
      relationName: "commentReplies",
    }),
    replies: many(postComments, { relationName: "commentReplies" }),
    reactions: many(postCommentReactions),
    // Status change tracking
    statusChangeFrom: one(postStatuses, {
      fields: [postComments.workspaceId, postComments.statusChangeFromId],
      references: [postStatuses.workspaceId, postStatuses.id],
      relationName: "commentStatusChangeFrom",
    }),
    statusChangeTo: one(postStatuses, {
      fields: [postComments.workspaceId, postComments.statusChangeToId],
      references: [postStatuses.workspaceId, postStatuses.id],
      relationName: "commentStatusChangeTo",
    }),
    deletedBy: one(principal, {
      fields: [postComments.workspaceId, postComments.deletedByPrincipalId],
      references: [principal.workspaceId, principal.id],
      relationName: "commentDeletedBy",
    }),
  }),
);

export const commentReactionsRelations = relations(
  postCommentReactions,
  ({ one }) => ({
    comment: one(postComments, {
      fields: [
        postCommentReactions.workspaceId,
        postCommentReactions.commentId,
      ],
      references: [postComments.workspaceId, postComments.id],
    }),
  }),
);

export const postTagAssignmentsRelations = relations(
  postTagAssignments,
  ({ one }) => ({
    post: one(posts, {
      fields: [postTagAssignments.workspaceId, postTagAssignments.postId],
      references: [posts.workspaceId, posts.id],
    }),
    tag: one(postTags, {
      fields: [postTagAssignments.workspaceId, postTagAssignments.tagId],
      references: [postTags.workspaceId, postTags.id],
    }),
  }),
);

// Post statuses relations (defined here to avoid circular dependency with statuses.ts)
export const postStatusesRelations = relations(postStatuses, ({ many }) => ({
  posts: many(posts),
}));

// Edit history relations
export const postEditHistoryRelations = relations(
  postEditHistory,
  ({ one }) => ({
    post: one(posts, {
      fields: [postEditHistory.workspaceId, postEditHistory.postId],
      references: [posts.workspaceId, posts.id],
    }),
    editor: one(principal, {
      fields: [postEditHistory.workspaceId, postEditHistory.editorPrincipalId],
      references: [principal.workspaceId, principal.id],
      relationName: "postEditHistoryEditor",
    }),
  }),
);

export const commentEditHistoryRelations = relations(
  postCommentEditHistory,
  ({ one }) => ({
    comment: one(postComments, {
      fields: [
        postCommentEditHistory.workspaceId,
        postCommentEditHistory.commentId,
      ],
      references: [postComments.workspaceId, postComments.id],
    }),
    editor: one(principal, {
      fields: [
        postCommentEditHistory.workspaceId,
        postCommentEditHistory.editorPrincipalId,
      ],
      references: [principal.workspaceId, principal.id],
      relationName: "commentEditHistoryEditor",
    }),
  }),
);

// Post notes relations
export const postNotesRelations = relations(postNotes, ({ one }) => ({
  post: one(posts, {
    fields: [postNotes.workspaceId, postNotes.postId],
    references: [posts.workspaceId, posts.id],
  }),
  author: one(principal, {
    fields: [postNotes.workspaceId, postNotes.principalId],
    references: [principal.workspaceId, principal.id],
    relationName: "noteAuthor",
  }),
}));
