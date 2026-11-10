import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
/** Situational guidance owned by exactly one Quinn agent (D4). */
import {
  text,
  boolean,
  integer,
  timestamp,
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

export const assistantGuidanceRules = quillsSchema
  .table(
    "assistant_guidance_rules",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("assistant_guidance")("id").notNull(),
      name: text("name").notNull(),
      appliesWhen: text("applies_when"),
      instruction: text("instruction").notNull(),
      /** The single agent this rule targets: 'agent' (customer-facing) or 'copilot'. */
      agent: text("agent").notNull(),
      enabled: boolean("enabled").notNull().default(true),
      // Lower values run first. This preserves the V1 position ordering.
      priority: integer("priority").notNull().default(0),
      // Nulled on the author's deletion — the rule outlives them.
      createdById: typeIdColumnNullable("principal")("created_by_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("assistant_guidance_rules_enabled_priority_idx").on(
        table.enabled,
        table.priority,
      ),
      check(
        "assistant_guidance_rules_name_length_check",
        sql`char_length(${table.name}) BETWEEN 1 AND 80`,
      ),
      check(
        "assistant_guidance_rules_applies_when_length_check",
        sql`${table.appliesWhen} IS NULL OR char_length(${table.appliesWhen}) BETWEEN 1 AND 500`,
      ),
      check(
        "assistant_guidance_rules_instruction_length_check",
        sql`char_length(${table.instruction}) BETWEEN 1 AND 1000`,
      ),
      check(
        "assistant_guidance_rules_agent_check",
        sql`${table.agent} IN ('agent', 'copilot', 'workspace')`,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.createdById],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const assistantGuidanceRulesRelations = relations(
  assistantGuidanceRules,
  ({ one }) => ({
    createdBy: one(principal, {
      fields: [
        assistantGuidanceRules.workspaceId,
        assistantGuidanceRules.createdById,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);
