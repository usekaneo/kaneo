import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  integer,
  index,
  foreignKey,
} from "drizzle-orm/pg-core";
import { typeIdColumn } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

/**
 * Ownership, ordering and turn leases for private workspace conversations.
 * Unused since the Copilot on Home chat was retired: nothing creates or reads
 * these threads now. The table stays so existing rows are kept.
 */
export const workspaceAssistantThreads = quillsSchema
  .table(
    "workspace_assistant_threads",
    {
      workspaceId: workspaceColumn(),
      key: text("key").notNull(),
      ownerPrincipalId:
        typeIdColumn("principal")("owner_principal_id").notNull(),
      title: text("title").notNull().default(""),
      revision: integer("revision").notNull().default(0),
      activeRunId: text("active_run_id"),
      leaseToken: text("lease_token"),
      leaseExpiresAt: timestamp("lease_expires_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
    },
    (table) => [
      foreignKey({
        name: "workspace_assistant_threads_owner_principal_id_fkey",
        columns: [table.workspaceId, table.ownerPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      index("workspace_assistant_threads_owner_updated_idx").on(
        table.ownerPrincipalId,
        table.updatedAt,
        table.key,
      ),
      primaryKey({ columns: [table.workspaceId, table.key] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();
