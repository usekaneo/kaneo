import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey } from "drizzle-orm/pg-core";
/**
 * Workspace Labs experiments.
 *
 * One row per workspace and registered experiment. Missing rows mean both
 * `visible` and `enabled` are false. Visibility controls Labs discoverability;
 * enabled controls runtime behavior. Hiding an enabled experiment does not
 * disable it.
 */
import { boolean, primaryKey, text, timestamp } from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { typeIdColumn } from "@kaneo/ids/drizzle";
import { settings } from "./auth";

export const workspaceExperiments = quillsSchema
  .table(
    "workspace_experiments",
    {
      workspaceId: workspaceColumn(),
      settingsId: typeIdColumn("workspace")("settings_id").notNull(),
      experimentId: text("experiment_id").notNull(),
      visible: boolean("visible").notNull().default(false),
      enabled: boolean("enabled").notNull().default(false),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow()
        .$onUpdate(() => new Date()),
    },
    (table) => [
      primaryKey({
        name: "workspace_experiments_pkey",
        columns: [table.workspaceId, table.settingsId, table.experimentId],
      }),
      foreignKey({
        columns: [table.workspaceId, table.settingsId],
        foreignColumns: [settings.workspaceId, settings.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const workspaceExperimentsRelations = relations(
  workspaceExperiments,
  ({ one }) => ({
    settings: one(settings, {
      fields: [
        workspaceExperiments.workspaceId,
        workspaceExperiments.settingsId,
      ],
      references: [settings.workspaceId, settings.id],
    }),
  }),
);
