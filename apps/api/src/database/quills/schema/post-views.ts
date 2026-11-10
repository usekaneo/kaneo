import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

/**
 * The serialized filter set stored on a saved view. Kept structural here — the
 * app owns the exact shape + zod validation in `lib/shared/post/views.ts`; the
 * client can't import this package, so that module is the single source of
 * truth for the shape and the view↔InboxFilters translation. This `$type` only
 * documents the JSON column.
 */
export interface PostViewFilters {
  status?: string[];
  board?: string[];
  tags?: string[];
  segmentIds?: string[];
  owner?: string;
  responded?: "responded" | "unresponded";
  minVotes?: number;
  minComments?: number;
  hasDuplicates?: true;
  showDeleted?: true;
  sort?: "newest" | "oldest" | "votes" | "priority";
  dateFrom?: string;
  dateTo?: string;
  updatedBefore?: string;
}

/**
 * Saved feedback-inbox views — workspace-shared filter sets over the post
 * inbox. A view is a saved `PostViewFilters`; running it restores the filters
 * client-side (it is not a server-side query object). Shared by default;
 * soft-deleted so a removed view keeps history. `createdByPrincipalId` is a
 * team actor (set null on delete so a shared view outlives its creator).
 * Scoped to the workspace by the connection.
 */
export const postViews = quillsSchema
  .table(
    "post_views",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("post_view")("id").notNull(),
      name: text("name").notNull(),
      filters: jsonb("filters").$type<PostViewFilters>().notNull(),
      // The teammate who created the view; set null on offboarding so a shared
      // view survives. Attribution only — never gates who may run the view.
      createdByPrincipalId: typeIdColumnNullable("principal")(
        "created_by_principal_id",
      ),
      // Every teammate sees a shared view. A private (personal) view sets this false.
      isShared: boolean("is_shared").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      foreignKey({
        name: "post_views_created_by_principal_id_fkey",
        columns: [table.workspaceId, table.createdByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      // Toolbar listing: shared, non-deleted views.
      index("post_views_shared_idx")
        .on(table.isShared)
        .where(sql`"deleted_at" IS NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type PostView = typeof postViews.$inferSelect;
