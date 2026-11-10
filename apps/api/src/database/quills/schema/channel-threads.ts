import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Inbound thread correlation: an external thread key on a channel account
 * maps to a conversation. Email keeps its Message-ID map as the authority;
 * other channels store their thread keys here.
 */
import {
  text,
  timestamp,
  uniqueIndex,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { channelAccounts } from "./channel-accounts";
import { conversations } from "./conversation";

export const channelThreads = quillsSchema
  .table(
    "channel_threads",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("channel_thread")("id").notNull(),
      channelAccountId:
        typeIdColumn("channel_account")("channel_account_id").notNull(),
      externalThreadKey: text("external_thread_key").notNull(),
      conversationId: typeIdColumn("conversation")("conversation_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("channel_threads_account_key_uq").on(
        table.workspaceId,
        table.channelAccountId,
        table.externalThreadKey,
      ),
      index("channel_threads_conversation_idx").on(table.conversationId),
      foreignKey({
        name: "channel_threads_channel_account_id_fkey",
        columns: [table.workspaceId, table.channelAccountId],
        foreignColumns: [channelAccounts.workspaceId, channelAccounts.id],
      }).onDelete("cascade"),
      foreignKey({
        name: "channel_threads_conversation_id_fkey",
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type ChannelThread = typeof channelThreads.$inferSelect;
