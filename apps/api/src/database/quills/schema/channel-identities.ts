import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";

import {
  text,
  timestamp,
  boolean,
  index,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import { typeIdColumn } from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import { conversations } from "./conversation";

/**
 * Per-channel identity map: a normalized external address on some channel
 * (email today) resolved to the principal it belongs to. This is the seam the
 * support platform uses for cold inbound — matching a sender to a known person
 * before any conversation exists — and the durable home the visitor-analytics
 * device map converges toward.
 *
 * No TypeID primary key: the natural key IS the identity, so the composite PK
 * (channel, external_id) is both the row identity and the uniqueness guarantee
 * (one principal per address per channel). `verified` records whether the
 * association was cryptographically proven (a verified identify) or merely
 * observed (we sent mail to it). The principal_id FK CASCADEs, and the
 * anonymous-to-identified merge re-points it (see principal-repoint.ts).
 */
export const channelIdentities = quillsSchema
  .table(
    "channel_identities",
    {
      workspaceId: workspaceColumn(),
      channel: text("channel").notNull(),
      /** Normalized external id for the channel (lower-cased email address). */
      externalId: text("external_id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      verified: boolean("verified").notNull().default(false),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Columns alphabetical: drizzle-kit introspects composite-PK columns in
      // alphabetical order and the drift check compares that order.
      primaryKey({
        name: "channel_identities_pkey",
        columns: [table.workspaceId, table.channel, table.externalId],
      }),
      foreignKey({
        name: "channel_identities_principal_id_fkey",
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      index("channel_identities_principal_idx").on(table.principalId),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Outbound conversation-email threading map: the Message-ID each notification
 * email went out with, keyed back to its conversation. Two jobs: building the
 * RFC 5322 References chain on the next outbound mail, and routing an inbound
 * reply whose client stripped the plus-address but preserved the
 * In-Reply-To/References headers (the Message-ID fallback). CASCADEs with the
 * conversation.
 *
 * `message_id` is the RFC822 id without its angle brackets, lower-cased for a
 * stable match, in the form the SENDING SIDE reported it. That is two shapes:
 * `local@host` where we chose the id, and `local` alone where the transport
 * chose it and reports it bare. A row is therefore not always a literal token a
 * reply will quote, so match through `resolveConversationByMessageIds` rather
 * than comparing this column to a header value directly. A provider's own
 * delivery events use the bare form and join straight onto it.
 */
export const conversationOutboundEmails = quillsSchema
  .table(
    "conversation_outbound_emails",
    {
      workspaceId: workspaceColumn(),
      messageId: text("message_id").notNull(),
      conversationId: typeIdColumn("conversation")("conversation_id").notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      foreignKey({
        name: "conversation_outbound_emails_conversation_id_fkey",
        columns: [table.workspaceId, table.conversationId],
        foreignColumns: [conversations.workspaceId, conversations.id],
      }).onDelete("cascade"),
      // Reverse lookup for the References chain, newest last.
      index("conversation_outbound_emails_conversation_idx").on(
        table.conversationId,
        table.createdAt,
      ),
      primaryKey({ columns: [table.workspaceId, table.messageId] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();
