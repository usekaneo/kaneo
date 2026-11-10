import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Teams — assignable groups of teammates for the support inbox (support
 * platform §4.12). Membership is a pure relationship, separate from role; the
 * conversation assignee is polymorphic (a team OR a teammate, two independent
 * nullable columns with no clearing rule).
 *
 * The database permits at most one active default team per workspace.
 * Teams linked to Kaneo derive their name and roster from the platform. `deleted_at` is a soft delete
 * so a removed team's set-null'd assignment history survives.
 *
 * `assignment_method` drives distribution when a conversation is assigned to
 * the team: `manual` assigns the team only, `round_robin` rotates over online
 * members (cursor persisted on `rr_cursor_principal_id`), `balanced` reuses the
 * least-loaded auto-assign strategy scoped to the team's members.
 */
import {
  text,
  boolean,
  timestamp,
  index,
  uniqueIndex,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import { teamTable } from "../../schema";
import { TEAM_ASSIGNMENT_METHODS } from "../types";

export const teams = quillsSchema
  .table(
    "teams",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("team")("id").notNull(),
      name: text("name").notNull(),
      kaneoTeamId: text("kaneo_team_id").references(() => teamTable.id, {
        onDelete: "set null",
      }),
      // Inbox-only display; never shown to customers.
      icon: text("icon"),
      color: text("color"),
      description: text("description"),
      // Clear the old default before setting its replacement in the same transaction.
      isDefault: boolean("is_default").notNull().default(false),
      // How a team-assigned conversation picks a member. Kept in sync with
      // TEAM_ASSIGNMENT_METHODS; 'manual' assigns the team only.
      assignmentMethod: text("assignment_method", {
        enum: TEAM_ASSIGNMENT_METHODS,
      })
        .notNull()
        .default("manual"),
      // Round-robin rotation cursor: the member assigned last. Set null if that
      // member is deleted; the rotation simply restarts from the top.
      rrCursorPrincipalId: typeIdColumnNullable("principal")(
        "rr_cursor_principal_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
      // Soft delete; set-null'd assignment history on conversations survives.
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      foreignKey({
        name: "teams_rr_cursor_principal_id_fkey",
        columns: [table.workspaceId, table.rrCursorPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      uniqueIndex("teams_kaneo_team_idx").on(
        table.workspaceId,
        table.kaneoTeamId,
      ),
      uniqueIndex("teams_one_default_idx")
        .on(table.workspaceId)
        .where(sql`${table.isDefault} AND ${table.deletedAt} IS NULL`),
      // The default team lookup skips soft-deleted rows.
      index("teams_is_default_idx")
        .on(table.id)
        .where(sql`is_default = true AND deleted_at IS NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const teamMembers = quillsSchema
  .table(
    "team_members",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("team_member")("id").notNull(),
      teamId: typeIdColumn("team")("team_id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      foreignKey({
        name: "team_members_team_id_fkey",
        columns: [table.workspaceId, table.teamId],
        foreignColumns: [teams.workspaceId, teams.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "team_members_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      // One membership per (team, principal). Declared in alphabetical column
      // order to match how drizzle-kit introspects the live index.
      uniqueIndex("team_members_principal_team_uq").on(
        table.workspaceId,
        table.principalId,
        table.teamId,
      ),
      // Members-of-team roster lookups.
      index("team_members_team_idx").on(table.teamId),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const teamsRelations = relations(teams, ({ many }) => ({
  members: many(teamMembers),
}));

export const teamMembersRelations = relations(teamMembers, ({ one }) => ({
  team: one(teams, {
    fields: [teamMembers.workspaceId, teamMembers.teamId],
    references: [teams.workspaceId, teams.id],
  }),
  principal: one(principal, {
    fields: [teamMembers.workspaceId, teamMembers.principalId],
    references: [principal.workspaceId, principal.id],
  }),
}));
