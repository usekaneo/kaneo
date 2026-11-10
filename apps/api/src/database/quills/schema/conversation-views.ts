import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";

import {
  text,
  timestamp,
  boolean,
  jsonb,
  index,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";

/**
 * The serialized rule set stored on a saved view (support platform §4.6). Kept
 * structural here — the app owns the exact rule taxonomy + zod validation (cap
 * 15 rules) in `lib/shared/conversation/views.ts`; the client can't import this
 * package, so that module is the single source of truth for the shape and the
 * rules→list-filter translation. This `$type` only documents the JSON column.
 */
export interface ConversationViewFilters {
  /** Ordered filter rules; all applied with AND (a saved filter set, not a query). */
  rules: Array<{ field: string; value?: unknown }>;
}

/**
 * Custom saved inbox views — workspace-shared filter sets over the conversation
 * list (§4.6). A view is a saved `ConversationViewFilters` + a sort; running it
 * translates the rules into the ordinary list filter client-side (it is not a
 * server-side query object). Shared by default; soft-deleted so a removed view
 * keeps history. `createdByPrincipalId` is a team actor (set null on delete so
 * a shared view outlives its creator). Scoped to the workspace by the connection.
 */
export const conversationViews = quillsSchema
  .table(
    "conversation_views",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("conversation_view")("id").notNull(),
      name: text("name").notNull(),
      filters: jsonb("filters").$type<ConversationViewFilters>().notNull(),
      // One of the five inbox sorts (recent / oldest / created / waiting /
      // priority); null falls back to the default (recent). Plain text; the app
      // constrains the taxonomy.
      sort: text("sort"),
      // The teammate who created the view; set null on offboarding so a shared
      // view survives. Attribution only — never gates who may run the view.
      createdByPrincipalId: typeIdColumnNullable("principal")(
        "created_by_principal_id",
      ),
      // Workspace-shared per the spec: every teammate sees a shared view. A
      // private (personal) view sets this false.
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
        name: "conversation_views_created_by_principal_id_fkey",
        columns: [table.workspaceId, table.createdByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      // Nav listing: shared, non-deleted views.
      index("conversation_views_shared_idx")
        .on(table.isShared)
        .where(sql`"deleted_at" IS NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Per-teammate view pins. Pinning is per-user, so it lives in this tiny join
 * table rather than a column on the view. The composite (principal, view)
 * primary key makes a pin idempotent; both FKs cascade. `principalId` is a team
 * actor (exempt from principal re-point). Columns declared in alphabetical
 * order to match drizzle-kit's composite-PK introspection.
 */
export const conversationViewPins = quillsSchema
  .table(
    "conversation_view_pins",
    {
      workspaceId: workspaceColumn(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      viewId: typeIdColumn("conversation_view")("view_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      primaryKey({
        name: "conversation_view_pins_pkey",
        columns: [table.workspaceId, table.principalId, table.viewId],
      }),
      foreignKey({
        name: "conversation_view_pins_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "conversation_view_pins_view_id_fkey",
        columns: [table.workspaceId, table.viewId],
        foreignColumns: [conversationViews.workspaceId, conversationViews.id],
      }).onDelete("cascade"),
      // Reverse lookup: everyone who pinned a given view.
      index("conversation_view_pins_view_idx").on(table.viewId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type ConversationView = typeof conversationViews.$inferSelect;
export type ConversationViewPin = typeof conversationViewPins.$inferSelect;
