import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
import { varchar, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";

export const emailLog = quillsSchema
  .table(
    "email_log",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("emaillog")("id").notNull(),
      direction: varchar("direction", { length: 16 }).notNull(),
      emailType: varchar("email_type", { length: 64 }).notNull(),
      provider: varchar("provider", { length: 32 }),
      messageId: text("message_id"),
      providerMessageId: text("provider_message_id"),
      principalId: typeIdColumnNullable("principal")("principal_id"),
      address: text("address").notNull(),
      subject: text("subject"),
      conversationId: typeIdColumnNullable("conversation")("conversation_id"),
      ticketId: typeIdColumnNullable("ticket")("ticket_id"),
      postId: typeIdColumnNullable("post")("post_id"),
      status: varchar("status", { length: 16 }).notNull(),
      error: text("error"),
      billable: boolean("billable").notNull().default(false),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (t) => [
      index("email_log_created_idx").on(t.createdAt),
      index("email_log_conversation_idx").on(t.conversationId),
      index("email_log_month_billable_idx")
        .on(t.createdAt)
        .where(
          sql`"direction" = 'outbound' AND "status" = 'sent' AND "billable" = true`,
        ),
      primaryKey({ columns: [t.workspaceId, t.id] }),
      workspacePolicy(t.workspaceId),
    ],
  )
  .enableRLS();
