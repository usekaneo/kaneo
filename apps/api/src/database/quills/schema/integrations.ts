import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
import {
  text,
  timestamp,
  jsonb,
  index,
  boolean,
  integer,
  varchar,
  unique,
  foreignKey,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import { postExternalLinks } from "./external-links";
import type {
  IntegrationConfig,
  EventMappingActionConfig,
  EventMappingFilters,
} from "../types";

/**
 * Integration configurations.
 * Stores OAuth tokens (encrypted), connection status, and integration-specific config.
 */
export const integrations = quillsSchema
  .table(
    "integrations",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("integration")("id").notNull(),
      integrationType: varchar("integration_type", { length: 50 }).notNull(),
      status: varchar("status", { length: 20 }).notNull().default("pending"),

      // Encrypted secrets blob (JSON, AES-256-GCM)
      // Contains integration-specific secrets (e.g., { accessToken: "xoxb-..." } for Slack)
      secrets: text("secrets"),

      // Configuration (channel IDs, team IDs, etc.)
      config: jsonb("config").$type<IntegrationConfig>().notNull().default({}),

      // Metadata
      connectedByPrincipalId: typeIdColumnNullable("principal")(
        "connected_by_principal_id",
      ),
      /** Service principal representing this integration's identity */
      principalId: typeIdColumnNullable("principal")("principal_id"),
      connectedAt: timestamp("connected_at", { withTimezone: true }),
      lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
      lastError: text("last_error"),
      lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
      errorCount: integer("error_count").notNull().default(0),

      // Health telemetry (WO-14) — feeds the settings-page health panel, since
      // hook_deliveries carries no integration attribution. (Error state reuses
      // the existing lastError/lastErrorAt columns above.)
      lastOutboundAt: timestamp("last_outbound_at", { withTimezone: true }),
      lastInboundAt: timestamp("last_inbound_at", { withTimezone: true }),

      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      unique("integration_type_unique").on(
        table.workspaceId,
        table.integrationType,
      ),
      // CHECK constraint to ensure error count is never negative
      check("error_count_non_negative", sql`error_count >= 0`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.connectedByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * Platform-level credentials for integrations (OAuth app credentials).
 * One row per provider. Secrets are AES-256-GCM encrypted.
 * Presence of a row = configured; no row = not configured.
 */
export const integrationPlatformCredentials = quillsSchema
  .table(
    "integration_platform_credentials",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("platform_cred")("id").notNull(),
      integrationType: varchar("integration_type", { length: 50 }).notNull(),
      secrets: text("secrets").notNull(),
      configuredByPrincipalId: typeIdColumnNullable("principal")(
        "configured_by_principal_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Named to match the migration's constraint (63-char pg truncation).
      foreignKey({
        name: "integration_platform_credentials_configured_by_principal_id_pri",
        columns: [table.workspaceId, table.configuredByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      unique("platform_cred_type_unique").on(
        table.workspaceId,
        table.integrationType,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const integrationPlatformCredentialsRelations = relations(
  integrationPlatformCredentials,
  ({ one }) => ({
    configuredBy: one(principal, {
      fields: [
        integrationPlatformCredentials.workspaceId,
        integrationPlatformCredentials.configuredByPrincipalId,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);

/**
 * Event-to-action mappings for integrations.
 * Defines what actions trigger when specific domain events occur.
 */
export const integrationEventMappings = quillsSchema
  .table(
    "integration_event_mappings",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("event_mapping")("id").notNull(),
      integrationId: typeIdColumn("integration")("integration_id").notNull(),
      eventType: varchar("event_type", { length: 100 }).notNull(),
      actionType: varchar("action_type", { length: 50 }).notNull(),
      actionConfig: jsonb("action_config")
        .$type<EventMappingActionConfig>()
        .notNull()
        .default({}),
      filters: jsonb("filters").$type<EventMappingFilters>(),
      /** Discriminator for multiple mappings of the same event+action (e.g. per-board targets) */
      targetKey: varchar("target_key", { length: 100 })
        .notNull()
        .default("default"),
      enabled: boolean("enabled").notNull().default(true),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      foreignKey({
        name: "event_mappings_integration_fk",
        columns: [table.workspaceId, table.integrationId],
        foreignColumns: [integrations.workspaceId, integrations.id],
      }).onDelete("cascade"),
      // Columns listed alphabetically: drizzle-kit introspects multi-column
      // UNIQUE constraints in alphabetical order, and the drift check compares
      // that order. The live constraint's real order comes from the migration.
      unique("mapping_unique").on(
        table.workspaceId,
        table.actionType,
        table.eventType,
        table.integrationId,
        table.targetKey,
      ),
      index("idx_event_mappings_lookup").on(
        table.integrationId,
        table.eventType,
        table.enabled,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// Relations
export const integrationsRelations = relations(
  integrations,
  ({ one, many }) => ({
    connectedBy: one(principal, {
      fields: [integrations.workspaceId, integrations.connectedByPrincipalId],
      references: [principal.workspaceId, principal.id],
      relationName: "integrationConnector",
    }),
    principal: one(principal, {
      fields: [integrations.workspaceId, integrations.principalId],
      references: [principal.workspaceId, principal.id],
      relationName: "integrationPrincipal",
    }),
    eventMappings: many(integrationEventMappings),
    externalLinks: many(postExternalLinks),
  }),
);

export const integrationEventMappingsRelations = relations(
  integrationEventMappings,
  ({ one }) => ({
    integration: one(integrations, {
      fields: [
        integrationEventMappings.workspaceId,
        integrationEventMappings.integrationId,
      ],
      references: [integrations.workspaceId, integrations.id],
    }),
  }),
);
