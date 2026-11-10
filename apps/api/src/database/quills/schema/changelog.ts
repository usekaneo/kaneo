import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  integer,
  index,
  uniqueIndex,
  jsonb,
  foreignKey,
  customType,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import { posts } from "./posts";
import type { TiptapContent } from "../types";

/** pgvector column, 1536 dims (OpenAI text-embedding-3-small). Local to this
 *  file, mirroring the per-schema-file `vector` customType convention (see
 *  conversation-summary.ts / posts.ts / kb.ts). Populated on publish/edit by
 *  `changelog-embedding.service.ts` (Quinn Phase 4: changelog grounding);
 *  drafts stay null until they are next published. */
const vector = customType<{ data: number[] }>({
  dataType() {
    return "vector(1536)";
  },
});

export const changelogEntries = quillsSchema
  .table(
    "changelog_entries",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("changelog")("id").notNull(),
      title: text("title").notNull(),
      content: text("content").notNull(),
      // Rich content stored as TipTap JSON (optional, for rich text support)
      contentJson: jsonb("content_json").$type<TiptapContent>(),
      // Author tracking (principal who created/last edited - only shown in admin views)
      principalId: typeIdColumnNullable("principal")("principal_id"),
      publishedAt: timestamp("published_at", { withTimezone: true }),
      displayDate: timestamp("display_date", { withTimezone: true }),
      // Timestamp the publish notification was sent; null until dispatched.
      notifiedAt: timestamp("notified_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      // Soft delete support
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
      // View count for analytics (incremented on public/widget page load)
      viewCount: integer("view_count").default(0).notNull(),
      // Optional hero image rendered at the top of the public entry detail page.
      featuredImageUrl: text("featured_image_url"),
      // Publish-notification targeting: a non-empty list restricts the
      // subscriber fan-out (email + in-app) to principals holding at least one
      // of these segments. [] = broadcast to every subscriber. Same "segment
      // list, [] = everyone" convention as the segment-gate primitive.
      segmentIds: jsonb("segment_ids").$type<string[]>().notNull().default([]),
      // Semantic embedding for Quinn grounding (Quinn Phase 4). Embedded on
      // publish/edit; drafts stay null. Track the model version so a re-embed
      // can find rows without losing data (mirrors posts.embedding_model).
      embedding: vector("embedding"),
      embeddingModel: text("embedding_model"),
      embeddingUpdatedAt: timestamp("embedding_updated_at", {
        withTimezone: true,
      }),
    },
    (table) => [
      index("changelog_published_at_idx").on(table.publishedAt),
      index("changelog_principal_id_idx").on(table.principalId),
      index("changelog_deleted_at_idx").on(table.deletedAt),
      // Full-text search (0309): the expression listChangelogs and workspace search match on.
      index("changelog_entries_search_idx").using(
        "gin",
        sql`to_tsvector('english', coalesce(${table.title}, '') || ' ' || coalesce(${table.content}, ''))`,
      ),
      // Workspace search: a title containing the query anywhere inside (0309).
      index("changelog_entries_title_trgm_idx").using(
        "gin",
        table.title.op("gin_trgm_ops"),
      ),
      index("changelog_embedding_hnsw_idx")
        .using("hnsw", sql`${table.embedding} vector_cosine_ops`)
        .where(sql`${table.embedding} IS NOT NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// Junction table for linking changelog entries to shipped posts
export const changelogEntryPosts = quillsSchema
  .table(
    "changelog_entry_posts",
    {
      workspaceId: workspaceColumn(),
      changelogEntryId:
        typeIdColumn("changelog")("changelog_entry_id").notNull(),
      postId: typeIdColumn("post")("post_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Named to match the migration's constraint (63-char pg truncation).
      foreignKey({
        name: "changelog_entry_posts_changelog_entry_id_changelog_entries_id_f",
        columns: [table.workspaceId, table.changelogEntryId],
        foreignColumns: [changelogEntries.workspaceId, changelogEntries.id],
      }).onDelete("cascade"),
      uniqueIndex("changelog_entry_posts_pk").on(
        table.workspaceId,
        table.changelogEntryId,
        table.postId,
      ),
      index("changelog_entry_posts_post_id_idx").on(table.postId),
      foreignKey({
        columns: [table.workspaceId, table.postId],
        foreignColumns: [posts.workspaceId, posts.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const changelogEntriesRelations = relations(
  changelogEntries,
  ({ one, many }) => ({
    author: one(principal, {
      fields: [changelogEntries.workspaceId, changelogEntries.principalId],
      references: [principal.workspaceId, principal.id],
      relationName: "changelogAuthor",
    }),
    linkedPosts: many(changelogEntryPosts),
  }),
);

export const changelogEntryPostsRelations = relations(
  changelogEntryPosts,
  ({ one }) => ({
    changelogEntry: one(changelogEntries, {
      fields: [
        changelogEntryPosts.workspaceId,
        changelogEntryPosts.changelogEntryId,
      ],
      references: [changelogEntries.workspaceId, changelogEntries.id],
    }),
    post: one(posts, {
      fields: [changelogEntryPosts.workspaceId, changelogEntryPosts.postId],
      references: [posts.workspaceId, posts.id],
    }),
  }),
);
