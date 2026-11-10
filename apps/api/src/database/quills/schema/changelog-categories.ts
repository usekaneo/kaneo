import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";

/**
 * Changelog categories (labels) and the entry <-> category link table
 * (Changelog Settings §2). Categories are name + color labels an admin
 * manages from Settings > Changelog > Labels; `segmentIds` is the cheap
 * per-category audience gate ("only show this category to [segments]") —
 * an empty array means everyone. `position` drives manual ordering in the
 * Labels list and the public/widget filter chips.
 */
import {
  text,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { changelogEntries } from "./changelog";

export const changelogCategories = quillsSchema
  .table(
    "changelog_categories",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("changelog_category")("id").notNull(),
      name: text("name").notNull(),
      color: text("color").notNull(),
      // Segments this category is restricted to; [] = everyone (no gating).
      segmentIds: jsonb("segment_ids").$type<string[]>().notNull().default([]),
      position: integer("position").default(0).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Case-insensitively unique label names.
      uniqueIndex("changelog_category_name_lower_idx").on(
        table.workspaceId,
        sql`lower(${table.name})`,
      ),
      index("changelog_category_position_idx").on(table.position),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// Junction table for linking changelog entries to categories (M:N). Composite
// PK (no surrogate id) — mirrors the entry <-> post link table's shape.
export const changelogEntryCategories = quillsSchema
  .table(
    "changelog_entry_categories",
    {
      workspaceId: workspaceColumn(),
      changelogEntryId:
        typeIdColumn("changelog")("changelog_entry_id").notNull(),
      categoryId: typeIdColumn("changelog_category")("category_id").notNull(),
    },
    (table) => [
      primaryKey({
        name: "changelog_entry_categories_pk",
        columns: [table.workspaceId, table.categoryId, table.changelogEntryId],
      }),
      foreignKey({
        name: "changelog_entry_categories_entry_fk",
        columns: [table.workspaceId, table.changelogEntryId],
        foreignColumns: [changelogEntries.workspaceId, changelogEntries.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "changelog_entry_categories_category_fk",
        columns: [table.workspaceId, table.categoryId],
        foreignColumns: [
          changelogCategories.workspaceId,
          changelogCategories.id,
        ],
      }).onDelete("cascade"),
      index("changelog_entry_categories_category_idx").on(table.categoryId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const changelogCategoriesRelations = relations(
  changelogCategories,
  ({ many }) => ({
    entryLinks: many(changelogEntryCategories),
  }),
);

export const changelogEntryCategoriesRelations = relations(
  changelogEntryCategories,
  ({ one }) => ({
    changelogEntry: one(changelogEntries, {
      fields: [
        changelogEntryCategories.workspaceId,
        changelogEntryCategories.changelogEntryId,
      ],
      references: [changelogEntries.workspaceId, changelogEntries.id],
    }),
    category: one(changelogCategories, {
      fields: [
        changelogEntryCategories.workspaceId,
        changelogEntryCategories.categoryId,
      ],
      references: [changelogCategories.workspaceId, changelogCategories.id],
    }),
  }),
);
