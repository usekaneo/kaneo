import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
/**
 * Remote MCP connectors — the Agent Connectors catalog.
 *
 * One row per remote server: identity, auth, a cached tool catalog with
 * annotations, per-tool policies, and per-agent availability. Secret material
 * (bearer tokens / oauth tokens) is encrypted at rest (purpose
 * `connector-secrets`) and never round-trips to the client.
 */
import {
  text,
  boolean,
  integer,
  timestamp,
  jsonb,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumnNullable } from "@kaneo/ids/drizzle";
import { principal } from "./auth";

export const CONNECTOR_AUTH_MODES = ["none", "bearer", "oauth"] as const;
export type ConnectorAuthMode = (typeof CONNECTOR_AUTH_MODES)[number];

export const CONNECTOR_STATUSES = ["connected", "error", "disabled"] as const;
export type ConnectorStatus = (typeof CONNECTOR_STATUSES)[number];

export const CONNECTOR_TOOL_POLICIES = ["always", "approval", "never"] as const;
export type ConnectorToolPolicy = (typeof CONNECTOR_TOOL_POLICIES)[number];

export interface ConnectorToolAnnotations {
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
}

export interface CachedConnectorTool {
  name: string;
  title?: string;
  description?: string;
  annotations: ConnectorToolAnnotations;
  /** JSON Schema for the tool's input, cached at discovery time. */
  inputSchema?: Record<string, unknown>;
  inputSchemaHash?: string;
  firstSeenAt: string;
}

export interface ConnectorToolPolicies {
  groupDefaults: { read: ConnectorToolPolicy; write: ConnectorToolPolicy };
  tools: Record<string, ConnectorToolPolicy>;
}

export interface ConnectorAssignments {
  agent: boolean;
  copilot: boolean;
  workspace?: boolean;
}

// Key order is jsonb-canonical (length, then bytewise) so the serialized
// column default matches what postgres stores for the migration's default;
// the drift check compares the two strings byte for byte.
export const DEFAULT_CONNECTOR_TOOL_POLICIES: ConnectorToolPolicies = {
  tools: {},
  groupDefaults: { read: "always", write: "approval" },
};

export const DEFAULT_CONNECTOR_ASSIGNMENTS: ConnectorAssignments = {
  agent: false,
  copilot: false,
};

export const connectors = quillsSchema
  .table(
    "connectors",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("connector")("id").notNull(),
      name: text("name").notNull(),
      slug: text("slug").notNull(),
      url: text("url").notNull(),
      authMode: text("auth_mode", { enum: CONNECTOR_AUTH_MODES }).notNull(),
      /** Encrypted JSON. Never selected into a client DTO. */
      secrets: text("secrets"),
      status: text("status", { enum: CONNECTOR_STATUSES })
        .notNull()
        .default("connected"),
      tools: jsonb("tools")
        .$type<CachedConnectorTool[]>()
        .notNull()
        .default([]),
      toolPolicies: jsonb("tool_policies")
        .$type<ConnectorToolPolicies>()
        .notNull()
        .default(DEFAULT_CONNECTOR_TOOL_POLICIES),
      assignments: jsonb("assignments")
        .$type<ConnectorAssignments>()
        .notNull()
        .default(DEFAULT_CONNECTOR_ASSIGNMENTS),
      enabled: boolean("enabled").notNull().default(true),
      lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
      lastCallAt: timestamp("last_call_at", { withTimezone: true }),
      lastError: text("last_error"),
      lastErrorAt: timestamp("last_error_at", { withTimezone: true }),
      errorCount: integer("error_count").notNull().default(0),
      createdByPrincipalId: typeIdColumnNullable("principal")(
        "created_by_principal_id",
      ),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("connectors_slug_lower_unique").on(
        table.workspaceId,
        sql`lower(${table.slug})`,
      ),
      uniqueIndex("connectors_name_lower_unique").on(
        table.workspaceId,
        sql`lower(${table.name})`,
      ),
      index("connectors_enabled_idx").on(table.enabled),
      check(
        "connectors_name_length_check",
        sql`char_length(${table.name}) BETWEEN 1 AND 80`,
      ),
      check(
        "connectors_slug_length_check",
        sql`char_length(${table.slug}) BETWEEN 1 AND 20`,
      ),
      check(
        "connectors_auth_mode_check",
        sql`${table.authMode} IN ('none', 'bearer', 'oauth')`,
      ),
      check(
        "connectors_status_check",
        sql`${table.status} IN ('connected', 'error', 'disabled')`,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.createdByPrincipalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const connectorsRelations = relations(connectors, ({ one }) => ({
  createdBy: one(principal, {
    fields: [connectors.workspaceId, connectors.createdByPrincipalId],
    references: [principal.workspaceId, principal.id],
  }),
}));
