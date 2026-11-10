import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey } from "drizzle-orm/pg-core";
import { text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { typeIdColumn } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

/** The setup emails a teammate has been sent: the welcome and the day-two nudge, once each. */
export const onboardingEmails = quillsSchema
  .table(
    "onboarding_emails",
    {
      workspaceId: workspaceColumn(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      kind: text("kind", { enum: ["welcome", "nudge"] }).notNull(),
      sentAt: timestamp("sent_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("onboarding_emails_principal_kind_idx").on(
        table.workspaceId,
        table.principalId,
        table.kind,
      ),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();
