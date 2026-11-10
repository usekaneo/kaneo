import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey, unique } from "drizzle-orm/pg-core";
/**
 * User tags schema
 *
 * Lightweight admin-applied labels for portal people, mirroring the post-tags
 * pattern: a tags table (unique name, color, soft delete) plus a join table
 * keyed (principal_id, tag_id) with both FKs cascading. Unlike segments,
 * tags carry no membership rules — assignment is always explicit.
 */
import {
  text,
  timestamp,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

export const userTags = quillsSchema
  .table(
    "user_tags",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("user_tag")("id").notNull(),
      name: text("name").notNull(),
      color: text("color").default("#6b7280").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      index("user_tags_deleted_at_idx").on(table.deletedAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.name),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const userTagAssignments = quillsSchema
  .table(
    "user_tag_assignments",
    {
      workspaceId: workspaceColumn(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      tagId: typeIdColumn("user_tag")("tag_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      foreignKey({
        name: "user_tag_assignments_principal_id_fk",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "user_tag_assignments_tag_id_fk",
        columns: [table.workspaceId, table.tagId],
        foreignColumns: [userTags.workspaceId, userTags.id],
      }).onDelete("cascade"),
      uniqueIndex("user_tag_assignments_pk").on(
        table.workspaceId,
        table.principalId,
        table.tagId,
      ),
      index("user_tag_assignments_tag_id_idx").on(table.tagId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const userTagsRelations = relations(userTags, ({ many }) => ({
  assignments: many(userTagAssignments),
}));

export const userTagAssignmentsRelations = relations(
  userTagAssignments,
  ({ one }) => ({
    tag: one(userTags, {
      fields: [userTagAssignments.workspaceId, userTagAssignments.tagId],
      references: [userTags.workspaceId, userTags.id],
    }),
    principal: one(principal, {
      fields: [userTagAssignments.workspaceId, userTagAssignments.principalId],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);
