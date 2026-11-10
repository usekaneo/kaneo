import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";

/**
 * Status page product (Status Product Spec §5): components + groups, incidents
 * and scheduled maintenance (one discriminated table), the public update
 * timeline, an append-only component status-event log that uptime bars are
 * derived from, principal-based subscriptions, and incident templates.
 *
 * Audience model: the page-level gate lives in StatusSettings (settings
 * metadata bag); per-component narrowing uses `segmentIds` — [] = everyone
 * who can see the page (the changelog-category gate pattern).
 */
import {
  text,
  boolean,
  timestamp,
  integer,
  index,
  uniqueIndex,
  jsonb,
  primaryKey,
  foreignKey,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import {
  typeIdWithDefault,
  typeIdColumn,
  typeIdColumnNullable,
} from "@kaneo/ids/drizzle";
import { principal } from "./auth";

/** Component status values (industry-standard 5-state model). */
export type StatusComponentStatus =
  | "operational"
  | "degraded_performance"
  | "partial_outage"
  | "major_outage"
  | "under_maintenance";

/** Incident lifecycle. Maintenance rows use the maintenance lifecycle instead. */
export type StatusIncidentStatus =
  | "investigating"
  | "identified"
  | "monitoring"
  | "resolved";
export type StatusMaintenanceStatus =
  | "scheduled"
  | "in_progress"
  | "verifying"
  | "completed";

export type StatusIncidentKind = "incident" | "maintenance";
export type StatusIncidentImpact =
  | "none"
  | "minor"
  | "major"
  | "critical"
  | "maintenance";

/** How a component status event was produced. */
export type StatusComponentEventSource =
  | "incident"
  | "maintenance"
  | "manual"
  | "api";

export type StatusSubscriptionScope = "page" | "components";
export type StatusSubscriptionSource =
  | "self_serve"
  | "auto"
  | "admin"
  | "csv_import";

export const statusComponentGroups = quillsSchema
  .table(
    "status_component_groups",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("status_group")("id").notNull(),
      name: text("name").notNull(),
      position: integer("position").default(0).notNull(),
      // Render the group collapsed by default on the public page.
      collapsed: boolean("collapsed").default(false).notNull(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const statusComponents = quillsSchema
  .table(
    "status_components",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("status_component")("id").notNull(),
      groupId: typeIdColumnNullable("status_group")("group_id"),
      name: text("name").notNull(),
      description: text("description"),
      status: text("status")
        .$type<StatusComponentStatus>()
        .default("operational")
        .notNull(),
      position: integer("position").default(0).notNull(),
      showUptime: boolean("show_uptime").default(true).notNull(),
      // Segments this component is visible to; [] = everyone who can see the page.
      segmentIds: jsonb("segment_ids").$type<string[]>().notNull().default([]),
      // Soft delete keeps incident history readable.
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("status_components_group_idx").on(table.groupId),
      index("status_components_deleted_at_idx").on(table.deletedAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.groupId],
        foreignColumns: [
          statusComponentGroups.workspaceId,
          statusComponentGroups.id,
        ],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/** Append-only status history; uptime bars are a step function over this log. */
export const statusComponentEvents = quillsSchema
  .table(
    "status_component_events",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("status_update")("id").notNull(),
      componentId: typeIdColumn("status_component")("component_id").notNull(),
      status: text("status").$type<StatusComponentStatus>().notNull(),
      source: text("source").$type<StatusComponentEventSource>().notNull(),
      incidentId: typeIdColumnNullable("status_incident")("incident_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("status_component_events_component_idx").on(
        table.componentId,
        table.createdAt,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.componentId],
        foreignColumns: [statusComponents.workspaceId, statusComponents.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const statusIncidents = quillsSchema
  .table(
    "status_incidents",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("status_incident")("id").notNull(),
      kind: text("kind").$type<StatusIncidentKind>().notNull(),
      title: text("title").notNull(),
      // Incident lifecycle or maintenance lifecycle depending on `kind`.
      status: text("status")
        .$type<StatusIncidentStatus | StatusMaintenanceStatus>()
        .notNull(),
      impact: text("impact")
        .$type<StatusIncidentImpact>()
        .default("none")
        .notNull(),
      // True when an admin pinned impact manually (stops auto-derivation).
      impactOverride: boolean("impact_override").default(false).notNull(),
      // Maintenance window bounds + automation switches.
      scheduledStartAt: timestamp("scheduled_start_at", { withTimezone: true }),
      scheduledEndAt: timestamp("scheduled_end_at", { withTimezone: true }),
      autoStart: boolean("auto_start").default(true).notNull(),
      autoComplete: boolean("auto_complete").default(true).notNull(),
      // Backfilled incidents set this in the past and never notify.
      startedAt: timestamp("started_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      resolvedAt: timestamp("resolved_at", { withTimezone: true }),
      backfilled: boolean("backfilled").default(false).notNull(),
      // Publish-email claim column (changelog notify pattern); null until the
      // email is sent, or stamped at publish when notify_subscribers is false.
      notifiedAt: timestamp("notified_at", { withTimezone: true }),
      // The publisher's "Email subscribers" choice. False means the publish
      // email is never sent. Such a row is stamped notified_at all the same, so
      // an older version's sweep (which doesn't read this column) never sends
      // it; this column, not notified_at, says whether it was emailed.
      notifySubscribers: boolean("notify_subscribers").default(true).notNull(),
      // When the title, scheduled window or affected services last changed
      // through an edit that posts no update; null until such an edit. The
      // status feed announces an edit made after the latest update.
      detailsEditedAt: timestamp("details_edited_at", { withTimezone: true }),
      createdBy: typeIdColumnNullable("principal")("created_by"),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("status_incidents_kind_status_idx").on(table.kind, table.status),
      index("status_incidents_started_at_idx").on(table.startedAt),
      index("status_incidents_deleted_at_idx").on(table.deletedAt),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.createdBy],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/** The public timeline: one row per posted update (the first is the publish body). */
export const statusIncidentTemplates = quillsSchema
  .table(
    "status_incident_templates",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("status_tmpl")("id").notNull(),
      name: text("name").notNull(),
      title: text("title").notNull(),
      body: text("body").notNull(),
      impact: text("impact")
        .$type<StatusIncidentImpact>()
        .default("minor")
        .notNull(),
      componentIds: jsonb("component_ids")
        .$type<string[]>()
        .notNull()
        .default([]),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const statusIncidentUpdates = quillsSchema
  .table(
    "status_incident_updates",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("status_update")("id").notNull(),
      incidentId: typeIdColumn("status_incident")("incident_id").notNull(),
      // Lifecycle status at the time of this update.
      status: text("status")
        .$type<StatusIncidentStatus | StatusMaintenanceStatus>()
        .notNull(),
      body: text("body").notNull(),
      createdBy: typeIdColumnNullable("principal")("created_by"),
      // Provenance: the template this update was inserted from, if any. Nulled on
      // template delete so the row survives; usage counts derive from count(*).
      templateId: typeIdColumnNullable("status_tmpl")("template_id"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      index("status_incident_updates_incident_idx").on(
        table.incidentId,
        table.createdAt,
      ),
      // Named to match migration 0201's pg-truncated (63-char) constraint name;
      // drizzle's generated name would be the untruncated 64-char form.
      foreignKey({
        name: "status_incident_updates_template_id_status_incident_templates_i",
        columns: [table.workspaceId, table.templateId],
        foreignColumns: [
          statusIncidentTemplates.workspaceId,
          statusIncidentTemplates.id,
        ],
      }).onDelete("set null"),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.incidentId],
        foreignColumns: [statusIncidents.workspaceId, statusIncidents.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.createdBy],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("set null"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/** M:N incident <-> component, plus the status applied to each while open. */
export const statusIncidentComponents = quillsSchema
  .table(
    "status_incident_components",
    {
      workspaceId: workspaceColumn(),
      incidentId: typeIdColumn("status_incident")("incident_id").notNull(),
      componentId: typeIdColumn("status_component")("component_id").notNull(),
      componentStatus: text("component_status")
        .$type<StatusComponentStatus>()
        .notNull(),
    },
    (table) => [
      // Explicit name + alphabetical column order match migration 0179 (drizzle-kit
      // introspects composite PK columns alphabetically).
      primaryKey({
        name: "status_incident_components_incident_id_component_id_pk",
        columns: [table.workspaceId, table.componentId, table.incidentId],
      }),
      index("status_incident_components_component_idx").on(table.componentId),
      foreignKey({
        columns: [table.workspaceId, table.incidentId],
        foreignColumns: [statusIncidents.workspaceId, statusIncidents.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.componentId],
        foreignColumns: [statusComponents.workspaceId, statusComponents.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const statusSubscriptions = quillsSchema
  .table(
    "status_subscriptions",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("status_sub")("id").notNull(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      scope: text("scope")
        .$type<StatusSubscriptionScope>()
        .default("page")
        .notNull(),
      // Component IDs when scope = 'components'; [] with scope 'page' = whole page.
      componentIds: jsonb("component_ids")
        .$type<string[]>()
        .notNull()
        .default([]),
      source: text("source").$type<StatusSubscriptionSource>().notNull(),
      // Soft opt-out so the audit trail survives an unsubscribe.
      unsubscribedAt: timestamp("unsubscribed_at", { withTimezone: true }),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("status_subscriptions_principal_idx").on(
        table.workspaceId,
        table.principalId,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export const statusComponentGroupsRelations = relations(
  statusComponentGroups,
  ({ many }) => ({
    components: many(statusComponents),
  }),
);

export const statusComponentsRelations = relations(
  statusComponents,
  ({ one, many }) => ({
    group: one(statusComponentGroups, {
      fields: [statusComponents.workspaceId, statusComponents.groupId],
      references: [statusComponentGroups.workspaceId, statusComponentGroups.id],
    }),
    incidentLinks: many(statusIncidentComponents),
    events: many(statusComponentEvents),
  }),
);

export const statusComponentEventsRelations = relations(
  statusComponentEvents,
  ({ one }) => ({
    component: one(statusComponents, {
      fields: [
        statusComponentEvents.workspaceId,
        statusComponentEvents.componentId,
      ],
      references: [statusComponents.workspaceId, statusComponents.id],
    }),
  }),
);

export const statusIncidentsRelations = relations(
  statusIncidents,
  ({ one, many }) => ({
    author: one(principal, {
      fields: [statusIncidents.workspaceId, statusIncidents.createdBy],
      references: [principal.workspaceId, principal.id],
    }),
    updates: many(statusIncidentUpdates),
    componentLinks: many(statusIncidentComponents),
  }),
);

export const statusIncidentUpdatesRelations = relations(
  statusIncidentUpdates,
  ({ one }) => ({
    incident: one(statusIncidents, {
      fields: [
        statusIncidentUpdates.workspaceId,
        statusIncidentUpdates.incidentId,
      ],
      references: [statusIncidents.workspaceId, statusIncidents.id],
    }),
    author: one(principal, {
      fields: [
        statusIncidentUpdates.workspaceId,
        statusIncidentUpdates.createdBy,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);

export const statusIncidentComponentsRelations = relations(
  statusIncidentComponents,
  ({ one }) => ({
    incident: one(statusIncidents, {
      fields: [
        statusIncidentComponents.workspaceId,
        statusIncidentComponents.incidentId,
      ],
      references: [statusIncidents.workspaceId, statusIncidents.id],
    }),
    component: one(statusComponents, {
      fields: [
        statusIncidentComponents.workspaceId,
        statusIncidentComponents.componentId,
      ],
      references: [statusComponents.workspaceId, statusComponents.id],
    }),
  }),
);

export const statusSubscriptionsRelations = relations(
  statusSubscriptions,
  ({ one }) => ({
    principal: one(principal, {
      fields: [
        statusSubscriptions.workspaceId,
        statusSubscriptions.principalId,
      ],
      references: [principal.workspaceId, principal.id],
    }),
  }),
);
