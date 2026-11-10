import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
/**
 * Web sources — public pages an admin adds by URL for Quinn to ground
 * answers on, alongside the knowledge base and snippets. The crawled text
 * (extracted at add time by `assistant/web-source.service.ts`, through the
 * SSRF guard) is what retrieval searches; the original URL is what a
 * citation links back to. Content is public by construction (the page was
 * publicly fetchable), so rows carry no audience tier.
 */
import {
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

export const assistantWebSources = quillsSchema
  .table(
    "assistant_web_sources",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("assistant_web_source")("id").notNull(),
      url: text("url").notNull(),
      title: text("title").notNull(),
      content: text("content").notNull(),
      enabled: boolean("enabled").notNull().default(true),
      fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
      // Nulled on the author's deletion — the source outlives them.
      createdById: typeIdColumnNullable("principal")("created_by_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("assistant_web_sources_url_uidx").on(
        table.workspaceId,
        table.url,
      ),
      index("assistant_web_sources_enabled_idx").on(table.enabled),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.createdById],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type AssistantWebSource = typeof assistantWebSources.$inferSelect;
