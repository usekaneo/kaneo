import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey, unique } from "drizzle-orm/pg-core";
/**
 * API Keys schema for public API authentication
 *
 * API keys are created by admins and used by external integrations
 * to authenticate with the public REST API.
 */
import { timestamp, varchar, index, text, check } from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";

/**
 * API Keys table
 *
 * Stores hashed API keys for authentication.
 * The actual key is only shown once on creation.
 */
export const apiKeys = quillsSchema
  .table(
    "api_keys",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("api_key")("id").notNull(),
      /** Human-readable name for the key */
      name: varchar("name", { length: 255 }).notNull(),
      /** SHA-256 hash of the API key (64 hex chars) */
      keyHash: varchar("key_hash", { length: 64 }).notNull(),
      /** First 12 characters of the key for identification (e.g., "qb_a1b2c3d4") */
      keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
      /** Principal who created this key (nullable — key survives if creator leaves) */
      createdById: typeIdColumnNullable("principal")("created_by_id"),
      /** Service principal representing this API key's identity */
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      /** Last time the key was used for authentication */
      lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
      /** Optional expiration date */
      expiresAt: timestamp("expires_at", { withTimezone: true }),
      /** When the key was created */
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      /** When the key was revoked (soft delete) */
      revokedAt: timestamp("revoked_at", { withTimezone: true }),
      /**
       * Optional JSON-encoded array of capability scopes. Used by
       * trusted internal endpoints — e.g. `["internal:tier-limits"]`.
       * Null/empty means a normal API key with no special capabilities
       * (subject to the principal's role for authorization). Never
       * serialized to the public API.
       */
      scopes: text("scopes"),
      /**
       * 'personal' keys act as their creator (permissions and row scope) and
       * stop working when the creator leaves. 'workspace' keys hold their own
       * role, as a workspace role assignment on `principalId`, and belong to
       * nobody; `createdById` is then only an audit record.
       */
      kind: text("kind")
        .$type<"personal" | "workspace">()
        .notNull()
        .default("personal"),
    },
    (table) => [
      // Index for listing keys by creator
      index("api_keys_created_by_id_idx").on(table.createdById),
      // Index for looking up the key's service principal
      index("api_keys_principal_id_idx").on(table.principalId),
      // Index for filtering active/revoked keys
      index("api_keys_revoked_at_idx").on(table.revokedAt),
      check(
        "api_keys_kind_check",
        sql`${table.kind} IN ('personal', 'workspace')`,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      unique().on(table.workspaceId, table.keyHash),
      foreignKey({
        columns: [table.workspaceId, table.createdById],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  createdBy: one(principal, {
    fields: [apiKeys.workspaceId, apiKeys.createdById],
    references: [principal.workspaceId, principal.id],
    relationName: "apiKeyCreator",
  }),
  principal: one(principal, {
    fields: [apiKeys.workspaceId, apiKeys.principalId],
    references: [principal.workspaceId, principal.id],
    relationName: "apiKeyPrincipal",
  }),
}));
