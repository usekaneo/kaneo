import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey, unique } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import {
  type BoardSettings,
  type BoardAccess,
  type RoadmapBaseFilter,
  ROADMAP_TYPES,
  ROADMAP_DATE_SOURCES,
  ROADMAP_FREQUENCIES,
  ROADMAP_VISIBILITIES,
  DEFAULT_BOARD_ACCESS,
} from "../types";
import { postStatuses } from "./statuses";

export const boards = quillsSchema
  .table(
    "boards",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("board")("id").notNull(),
      slug: text("slug").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      // v1 access controls — per-action tier matrix. Replaces the legacy
      // `audience` jsonb column (dropped in migration 0080) and the older
      // `is_public` boolean before that.
      access: jsonb("access")
        .$type<BoardAccess>()
        .default(DEFAULT_BOARD_ACCESS)
        .notNull(),
      settings: jsonb("settings").$type<BoardSettings>().default({}).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      // Soft delete support
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      // Note: boards_slug_unique constraint already provides uniqueness; no separate index needed
      index("boards_deleted_at_idx").on(table.deletedAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.slug),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const roadmaps = quillsSchema
  .table(
    "roadmaps",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("roadmap")("id").notNull(),
      slug: text("slug").notNull(),
      name: text("name").notNull(),
      description: text("description"),
      type: text("type", { enum: ROADMAP_TYPES }).default("column").notNull(),
      baseFilter: jsonb("base_filter")
        .$type<RoadmapBaseFilter>()
        .default({})
        .notNull(),
      dateSource: text("date_source", { enum: ROADMAP_DATE_SOURCES }),
      frequency: text("frequency", { enum: ROADMAP_FREQUENCIES }),
      visibility: text("visibility", { enum: ROADMAP_VISIBILITIES })
        .default("public")
        .notNull(),
      visibleSegmentIds: jsonb("visible_segment_ids").$type<string[] | null>(),
      position: integer("position").notNull().default(0),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      // Soft delete support
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      // Note: roadmaps_slug_unique constraint already provides uniqueness; no separate index needed
      index("roadmaps_position_idx").on(table.position),
      index("roadmaps_visibility_idx").on(table.visibility),
      index("roadmaps_deleted_at_idx").on(table.deletedAt),
      check("roadmaps_type_check", sql`${table.type} IN ('column', 'date')`),
      check(
        "roadmaps_date_source_check",
        sql`${table.dateSource} IS NULL OR ${table.dateSource} = 'eta'`,
      ),
      check(
        "roadmaps_frequency_check",
        sql`${table.frequency} IS NULL OR ${table.frequency} IN ('monthly', 'quarterly', 'semiannual')`,
      ),
      check(
        "roadmaps_visibility_check",
        sql`${table.visibility} IN ('public', 'team', 'segment')`,
      ),
      check(
        "roadmaps_base_filter_object_check",
        sql`jsonb_typeof(${table.baseFilter}) = 'object'`,
      ),
      check(
        "roadmaps_visible_segment_ids_array_check",
        sql`${table.visibleSegmentIds} IS NULL OR jsonb_typeof(${table.visibleSegmentIds}) = 'array'`,
      ),
      check(
        "roadmaps_type_config_check",
        sql`(
        (${table.type} = 'column' AND ${table.dateSource} IS NULL AND ${table.frequency} IS NULL)
        OR
        (${table.type} = 'date' AND ${table.dateSource} = 'eta' AND ${table.frequency} IS NOT NULL)
      )`,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.slug),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const roadmapColumns = quillsSchema
  .table(
    "roadmap_columns",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("roadmap_col")("id").notNull(),
      roadmapId: typeIdColumn("roadmap")("roadmap_id").notNull(),
      statusId: typeIdColumn("post_status")("status_id").notNull(),
      name: text("name").notNull(),
      icon: text("icon"),
      color: text("color").notNull(),
      position: integer("position").notNull().default(0),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("roadmap_columns_roadmap_status_unique").on(
        table.workspaceId,
        table.roadmapId,
        table.statusId,
      ),
      index("roadmap_columns_roadmap_position_idx").on(
        table.roadmapId,
        table.position,
      ),
      index("roadmap_columns_status_id_idx").on(table.statusId),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.roadmapId],
        foreignColumns: [roadmaps.workspaceId, roadmaps.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.statusId],
        foreignColumns: [postStatuses.workspaceId, postStatuses.id],
      }).onDelete("restrict"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const postTags = quillsSchema
  .table(
    "post_tags",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_tag")("id").notNull(),
      name: text("name").notNull(),
      color: text("color").default("#6b7280").notNull(),
      description: text("description"),
      // Matching rule for AI auto-tagging: new posts are evaluated against every
      // tag whose prompt is set, and matching tags are assigned automatically.
      aiPrompt: text("ai_prompt"),
      // Portal visibility: when false the tag is internal — non-team portal
      // viewers never see it in filter lists or on posts. Team actors see all.
      isPublic: boolean("is_public").default(true).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      // Soft delete support
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      index("post_tags_deleted_at_idx").on(table.deletedAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.name),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// Relations - defined after posts import to avoid circular dependency
import { posts } from "./posts";
import { changelogEntries } from "./changelog";

export const boardsRelations = relations(boards, ({ many }) => ({
  posts: many(posts),
  changelogEntries: many(changelogEntries),
}));

export const roadmapsRelations = relations(roadmaps, ({ many }) => ({
  columns: many(roadmapColumns),
}));

export const roadmapColumnsRelations = relations(roadmapColumns, ({ one }) => ({
  roadmap: one(roadmaps, {
    fields: [roadmapColumns.workspaceId, roadmapColumns.roadmapId],
    references: [roadmaps.workspaceId, roadmaps.id],
  }),
  status: one(postStatuses, {
    fields: [roadmapColumns.workspaceId, roadmapColumns.statusId],
    references: [postStatuses.workspaceId, postStatuses.id],
  }),
}));

export const postTagsRelations = relations(postTags, ({ many }) => ({
  postTagAssignments: many(postTagAssignments),
}));

import { postTagAssignments } from "./posts";
