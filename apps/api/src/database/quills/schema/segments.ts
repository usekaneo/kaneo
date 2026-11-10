import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { foreignKey, primaryKey } from "drizzle-orm/pg-core";
/**
 * User Segmentation schema
 *
 * Supports two segment types:
 * - manual: Admin explicitly assigns/removes users
 * - dynamic: Membership is computed from rules and cached in the join table
 *
 * Both types share the same userSegments join table — dynamic segments
 * are treated as a cached result set, evaluated periodically and synced.
 */
import {
  text,
  timestamp,
  index,
  uniqueIndex,
  jsonb,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { typeIdWithDefault, typeIdColumn } from "@kaneo/ids/drizzle";
import { principal } from "./auth";
import type { UserAttributeType, CurrencyCode } from "./user-attributes";

// ============================================
// Rule types (stored as JSON in dynamic segments)
// ============================================

export type SegmentRuleOperator =
  | "eq"
  | "neq"
  | "lt"
  | "lte"
  | "gt"
  | "gte"
  | "contains"
  | "starts_with"
  | "ends_with"
  | "in"
  | "is_set"
  | "is_not_set";

export type SegmentRuleAttribute =
  | "email"
  | "email_verified"
  | "created_at_days_ago"
  | "post_count"
  | "vote_count"
  | "comment_count"
  | "plan"
  | "metadata_key"
  | "name"
  | "locale"
  | "country"
  | "last_active_days_ago"
  | "signup_source"
  | "principal_type"
  // Company predicates (§K3): resolved through principal.company_id -> companies,
  // so segments stay the single targeting primitive for company-scoped audiences.
  | "company_plan"
  | "company_mrr"
  | "company_size"
  | "company_industry"
  | "company_attr";

export interface SegmentCondition {
  attribute: SegmentRuleAttribute;
  operator: SegmentRuleOperator;
  /** Required for value-based operators; omit for is_set / is_not_set. Array for 'in' operator. */
  value?: string | number | boolean | (string | number)[];
  /** For metadata_key attribute: the key to look up in user.metadata JSON.
   *  For company_attr: the key to look up in companies.custom_attributes. */
  metadataKey?: string;
}

export interface SegmentRules {
  /** 'all' = AND logic; 'any' = OR logic between conditions */
  match: "all" | "any";
  conditions: SegmentCondition[];
}

// ============================================
// User attribute types (for segment weighting)
// ============================================

/** Inline attribute reference stored in segment weight config JSON */
export interface UserAttributeDefinition {
  /** The metadata key to read from user.metadata */
  key: string;
  /** Human-readable label */
  label: string;
  /** Data type — determines parsing and display */
  type: UserAttributeType;
  /** For currency type: the ISO 4217 currency code (e.g. 'USD') */
  currencyCode?: CurrencyCode;
}

/** Weighting configuration for a segment */
export interface SegmentWeightConfig {
  /** The user attribute to weight by */
  attribute: UserAttributeDefinition;
  /** Aggregation method for the attribute across segment members */
  aggregation: "sum" | "average" | "count" | "median";
}

// ============================================
// Evaluation schedule types
// ============================================

/** Schedule for automatic re-evaluation of dynamic segments */
export interface EvaluationSchedule {
  /** Whether auto-evaluation is enabled */
  enabled: boolean;
  /** Cron pattern (e.g. '0 * * * *' for hourly, '0 0 * * *' for daily) */
  pattern: string;
}

// ============================================
// Tables
// ============================================

/**
 * Segments table — workspace-scoped user groups
 *
 * type='manual': Members are assigned/removed by admins.
 * type='dynamic': Members are computed from `rules` JSON and cached in user_segments.
 */
export const segments = quillsSchema
  .table(
    "segments",
    {
      workspaceId: workspaceColumn(),
      id: typeIdWithDefault("segment")("id").notNull(),
      name: text("name").notNull(),
      /**
       * URL-safe stable identifier. Required for new rows; backfilled from
       * name in migration. Unique across non-deleted rows. Used by the
       * widget identity-token `segments` claim and the REST
       * `/api/v1/segments/:slug/members` route.
       */
      slug: text("slug").notNull(),
      description: text("description"),
      /** 'manual' | 'dynamic' */
      type: text("type", { enum: ["manual", "dynamic"] })
        .notNull()
        .default("manual"),
      /** Optional hex color for UI display (e.g. '#6366f1') */
      color: text("color").default("#6b7280").notNull(),
      /** Rule definition for dynamic segments (null for manual) */
      rules: jsonb("rules").$type<SegmentRules | null>(),
      /** Auto-evaluation schedule for dynamic segments (null = manual only) */
      evaluationSchedule: jsonb(
        "evaluation_schedule",
      ).$type<EvaluationSchedule | null>(),
      /** Weighting config for segment-level analytics (e.g. weight by MRR) */
      weightConfig: jsonb("weight_config").$type<SegmentWeightConfig | null>(),
      createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .$onUpdate(() => new Date())
        .notNull(),
      deletedAt: timestamp("deleted_at", { withTimezone: true }),
    },
    (table) => [
      index("segments_type_idx").on(table.type),
      index("segments_deleted_at_idx").on(table.deletedAt),
      uniqueIndex("segments_slug_unique")
        .on(table.workspaceId, table.slug)
        .where(sql`deleted_at IS NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

/**
 * User-segment join table
 *
 * Shared by both manual and dynamic segments.
 * For dynamic segments this is the evaluation cache, rebuilt on each evaluation run.
 *
 * Uses principalId as the user identifier (principal with role='user').
 */
export const userSegments = quillsSchema
  .table(
    "user_segments",
    {
      workspaceId: workspaceColumn(),
      principalId: typeIdColumn("principal")("principal_id").notNull(),
      segmentId: typeIdColumn("segment")("segment_id").notNull(),
      /**
       * Provenance of the membership:
       * - manual   = admin assigned via admin UI
       * - dynamic  = computed by the dynamic-segment rules evaluator
       * - sso      = synced from the IdP "groups" claim at login
       * - widget   = supplied via signed widget identity token
       * - api      = supplied via REST API (POST /api/v1/segments/:slug/members)
       */
      addedBy: text("added_by", {
        enum: ["manual", "dynamic", "sso", "widget", "api"],
      })
        .notNull()
        .default("manual"),
      addedAt: timestamp("added_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      uniqueIndex("user_segments_pk").on(
        table.workspaceId,
        table.principalId,
        table.segmentId,
      ),
      index("user_segments_segment_id_idx").on(table.segmentId),
      // DB-level backstop for the enum above, created by the SQL migration.
      check(
        "user_segments_added_by_check",
        sql`added_by = ANY (ARRAY['manual'::text, 'dynamic'::text, 'sso'::text, 'widget'::text, 'api'::text])`,
      ),
      foreignKey({
        columns: [table.workspaceId, table.principalId],
        foreignColumns: [principal.workspaceId, principal.id],
      }).onDelete("cascade"),
      foreignKey({
        columns: [table.workspaceId, table.segmentId],
        foreignColumns: [segments.workspaceId, segments.id],
      }).onDelete("cascade"),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

// ============================================
// Relations
// ============================================

export const segmentsRelations = relations(segments, ({ many }) => ({
  members: many(userSegments),
}));

export const userSegmentsRelations = relations(userSegments, ({ one }) => ({
  segment: one(segments, {
    fields: [userSegments.workspaceId, userSegments.segmentId],
    references: [segments.workspaceId, segments.id],
  }),
  principal: one(principal, {
    fields: [userSegments.workspaceId, userSegments.principalId],
    references: [principal.workspaceId, principal.id],
  }),
}));
