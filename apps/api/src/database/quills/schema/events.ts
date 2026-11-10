import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/** Workspace-scoped durable outbox. The Quills worker delivers cache invalidations at least once; eventId is stable across retries. */
import {
  bigint,
  text,
  jsonb,
  smallint,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

export const events = quillsSchema
  .table(
    "events",
    {
      workspaceId: workspaceColumn(),
      /** Global monotonic sequence — the total event order for this instance. */
      id: bigint("id", { mode: "bigint" })
        .generatedAlwaysAsIdentity()
        .notNull(),
      /** App-facing TypeID ('evt_...'); stable across relay attempts for receiver dedupe. */
      eventId: text("event_id").notNull(),
      /** Catalogue key, e.g. 'post.status_changed'. */
      type: text("type").notNull(),
      /** Aggregate kind, e.g. 'post'. */
      entityType: text("entity_type").notNull(),
      /** Branded TypeID of the subject aggregate. */
      entityId: text("entity_id").notNull(),
      /** 'user' | 'anonymous' | 'service' | 'support' | 'system'. */
      actorType: text("actor_type").notNull(),
      actorId: text("actor_id"),
      /** Validated against the catalogue zod schema before insert. Minimal snapshot. */
      payload: jsonb("payload").notNull(),
      /** { correlationId, causationId, depth, source } — loop tracing + provenance. */
      context: jsonb("context").notNull().default({}),
      schemaVersion: smallint("schema_version").notNull().default(1),
      /** Emission-side idempotency handle (schedulers, retried handlers). */
      dedupeKey: text("dedupe_key"),
      occurredAt: timestamp("occurred_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      /** NULL = outbox-pending; set by the relay once fanned out. */
      publishedAt: timestamp("published_at", { withTimezone: true }),
      /**
       * Who may drain this unpublished row. New rows default to `job`.
       * Leftover `relay` rows are converted onto the job path at job-worker /
       * scheduler start.
       */
      dispatchOwner: text("dispatch_owner").notNull().default("job"),
    },
    (table) => [
      uniqueIndex("events_event_id_idx").on(table.workspaceId, table.eventId),
      // Hot outbox drain path — partial so it stays tiny regardless of table size.
      index("events_unpublished_idx")
        .on(table.id)
        .where(sql`${table.publishedAt} IS NULL`),
      index("events_entity_idx").on(table.entityType, table.entityId, table.id),
      index("events_type_idx").on(table.type, table.id),
      uniqueIndex("events_dedupe_idx")
        .on(table.workspaceId, table.dedupeKey)
        .where(sql`${table.dedupeKey} IS NOT NULL`),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type EventRow = typeof events.$inferSelect;
export type NewEventRow = typeof events.$inferInsert;
