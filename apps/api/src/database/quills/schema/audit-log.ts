import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Audit log of security-sensitive admin actions.
 *
 * Append-only record of every change to authentication policy, recovery
 * codes, two-factor resets, and admin-driven role changes. Read by
 * compliance reviewers (SOC2 CC6.2, CC7.2) and surfaced in the admin UI
 * as a paginated, filterable feed.
 *
 * Actor identity is denormalised (email, role) so removed admins still
 * leave a coherent trace; `actor_user_id` is nullable so user deletion
 * preserves the audit row.
 */
import { text, timestamp, index, jsonb, foreignKey } from "drizzle-orm/pg-core";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";
import { user, principal } from "./auth";

export const auditLog = quillsSchema
  .table(
    "audit_log",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("audit")("id").notNull(),
      occurredAt: timestamp("occurred_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      /** Null when the actor's user row has been deleted. */
      actorUserId: typeIdColumnNullable("user")("actor_user_id"),
      actorPrincipalId: typeIdColumnNullable("principal")("actor_principal_id"),
      /** Denormalised so deletions don't anonymise old rows. */
      actorEmail: text("actor_email"),
      /** Actor's role at write time ('admin' | 'member' | 'user' | 'service'). */
      actorRole: text("actor_role"),
      actorIp: text("actor_ip"),
      actorUserAgent: text("actor_user_agent"),
      /** Correlation handle — value of x-request-id / x-correlation-id header, if present. */
      requestId: text("request_id"),
      /** Denormalised principal type at write time ('user' | 'service' | 'anonymous' | 'system' | 'api_key' | 'support'). */
      actorType: text("actor_type"),
      /** Auth method used for sign-in events ('password' | 'sso' | 'oauth' | 'magic_link' | 'ott' | 'api_key' | 'session'). */
      authMethod: text("auth_method"),
      /** Dotted taxonomy — see `AuditEventType`. */
      eventType: text("event_type").notNull(),
      /** 'success' | 'failure'. */
      eventOutcome: text("event_outcome").notNull().default("success"),
      /** What was acted on — e.g. 'sso_verified_domain', 'user', 'settings'. */
      targetType: text("target_type"),
      targetId: text("target_id"),
      beforeValue: jsonb("before_value"),
      afterValue: jsonb("after_value"),
      metadata: jsonb("metadata"),
      /**
       * What carried the change: 'ui' | 'api' | 'mcp' | 'assistant' | 'workflow' |
       * 'system'. Null on rows written before attribution existed and on paths
       * no boundary attributes.
       */
      channel: text("channel"),
      /** The credential that made the change: 'api_key' | 'oauth_client', or null. */
      credentialKind: text("credential_kind"),
      /** The API key id or OAuth client id. */
      credentialId: text("credential_id"),
      /** The credential's name at write time: the key name or the OAuth client's registered name. */
      clientName: text("client_name"),
      /**
       * The person a credential acts for: the OAuth user, or the teammate who
       * created the API key. No foreign key, like the denormalised actor fields.
       */
      onBehalfOfPrincipalId: typeIdColumnNullable("principal")(
        "on_behalf_of_principal_id",
      ),
    },
    (table) => [
      foreignKey({
        columns: [table.workspaceId, table.actorPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      index("audit_log_workspace_actor_idx").on(
        table.workspaceId,
        table.actorPrincipalId,
        table.occurredAt,
      ),
      // Named to match the constraint the SQL migration created.
      foreignKey({
        name: "audit_log_actor_user_id_fkey",
        columns: [table.workspaceId, table.actorUserId],
        foreignColumns: [user.workspaceId, user.id],
      }).onDelete("set null"),
      // occurred_at is DESC (nullsFirst = postgres default for plain DESC)
      // to serve the newest-first feed, matching the migration.
      index("audit_log_occurred_at_idx").on(
        table.occurredAt.desc().nullsFirst(),
      ),
      index("audit_log_actor_user_id_occurred_at_idx").on(
        table.actorUserId,
        table.occurredAt.desc().nullsFirst(),
      ),
      index("audit_log_event_type_occurred_at_idx").on(
        table.eventType,
        table.occurredAt.desc().nullsFirst(),
      ),
      index("audit_log_request_id_idx").on(table.requestId),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();
