import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * The workspace's mail provider tenant, when the operator isolates sending
 * reputation per workspace (`EMAIL_SES_TENANTS`).
 *
 * One row per tenant name. The name is derived from the workspace key, so a
 * workspace has one row; it is the key rather than a fixed singleton so a
 * workspace whose key changed starts a fresh row instead of reading another
 * name's state. Written by the reconcile job and by the send path when the
 * provider says the tenant is paused; read on every tenanted send.
 */
import { text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const emailSesTenants = quillsSchema
  .table(
    "email_ses_tenants",
    {
      workspaceId: workspaceColumn(),
      tenantName: text("tenant_name").notNull(),
      /** The provider's ARN for the tenant, once created. */
      tenantArn: text("tenant_arn"),
      /** Every resource ARN associated with the tenant, as last reconciled. */
      associatedArns: jsonb("associated_arns")
        .$type<string[]>()
        .notNull()
        .default(sql`'[]'::jsonb`),
      /**
       * From domains whose sending identity is associated, so a send from one
       * passes the provider's check. A send from any other domain goes untenanted.
       */
      fromDomains: jsonb("from_domains")
        .$type<string[]>()
        .notNull()
        .default(sql`'[]'::jsonb`),
      /** The configuration set associated, by name. A send must use this one. */
      configurationSet: text("configuration_set"),
      /** When the tenant, the configuration set and the platform identity were all associated. */
      readyAt: timestamp("ready_at", { withTimezone: true }),
      /** `ENABLED`, `REINSTATED` or `DISABLED`, as last read or as a refused send reported. */
      sendingStatus: text("sending_status"),
      /** The provider's reason for a pause, made safe to keep. */
      statusCause: text("status_cause"),
      statusCheckedAt: timestamp("status_checked_at", { withTimezone: true }),
      /** Set when managers were told of the current pause; cleared once sending resumes. */
      pausedNotifiedAt: timestamp("paused_notified_at", { withTimezone: true }),
      /** The last reconcile that finished, complete or not. */
      reconciledAt: timestamp("reconciled_at", { withTimezone: true }),
      /** Why the last reconcile stopped short, for the operator. */
      lastError: text("last_error"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.tenantName] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type EmailSesTenant = typeof emailSesTenants.$inferSelect;
