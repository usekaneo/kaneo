import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
/**
 * Changelog subscriber model (Changelog Settings §2, opt-out semantics):
 * one row per subscribed principal. `source` records how the row was created
 * (auto-subscribe, self-serve, CSV import, or an admin adding someone
 * manually); `unsubscribedAt` is a soft opt-out so the audit trail (who
 * subscribed, when) survives an unsubscribe. `getChangelogSubscriberTargets`
 * (events/targets.ts) reads the not-unsubscribed rows as the primary
 * subscriber source, unioned with the legacy linked-post subscribers.
 */
import { text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

export type ChangelogSubscriptionSource =
  | "auto"
  | "self_serve"
  | "csv_import"
  | "admin";

export const changelogSubscriptions = quillsSchema
  .table(
    "changelog_subscriptions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("changelog_sub")("id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      source: text("source").$type<ChangelogSubscriptionSource>().notNull(),
      unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("changelog_subscriptions_principal_idx").on(
        table.workspaceId,
        table.principalId,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const changelogSubscriptionsRelations = relations(
  changelogSubscriptions,
  ({ one }) => ({
    principal: one(principal, {
      fields: [
        changelogSubscriptions.workspaceId,
        changelogSubscriptions.principalId,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);
