import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";

import {
  text,
  timestamp,
  primaryKey,
  foreignKey,
  index,
} from "drizzle-orm/pg-core";
import { typeIdColumn } from "@kaneo/ids/drizzle";
import { principal } from "./auth";
export const slackUserLinks = quillsSchema
  .table(
    "slack_user_links",
    {
      workspaceId: workspaceColumn(),
      slackTeamId: text("slack_team_id").notNull(),
      slackUserId: text("slack_user_id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      method: text("method", { enum: ["email", "manual"] }).notNull(),
      linkedAt: timestamp("linked_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      suggestedPromptsAt: timestamp("suggested_prompts_at", {
        withTimezone: true,
      }),
    },
    (table) => [
      primaryKey({
        name: "slack_user_links_pkey",
        columns: [table.workspaceId, table.slackTeamId, table.slackUserId],
      }),
      foreignKey({
        name: "slack_user_links_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/** Channel threads the assistant is participating in until stopped or idle. */
export const slackThreadSessions = quillsSchema
  .table(
    "slack_thread_sessions",
    {
      workspaceId: workspaceColumn(),
      slackTeamId: text("slack_team_id").notNull(),
      channelId: text("channel_id").notNull(),
      threadTs: text("thread_ts").notNull(),
      status: text("status", { enum: ["active", "stopped"] }).notNull(),
      lastSpeaker: text("last_speaker", { enum: ["bot", "human"] }).notNull(),
      lastEventAt: timestamp("last_event_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => [
      primaryKey({
        name: "slack_thread_sessions_pkey",
        columns: [
          table.workspaceId,
          table.slackTeamId,
          table.channelId,
          table.threadTs,
        ],
      }),
      index("slack_thread_sessions_last_event_idx").on(table.lastEventAt),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();
