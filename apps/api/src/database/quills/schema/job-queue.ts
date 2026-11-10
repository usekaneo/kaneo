import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/** Workspace-scoped PostgreSQL jobs. Claims use SKIP LOCKED and expiring fencing tokens; only registered queues are executed. */
import {
  bigint,
  text,
  jsonb,
  integer,
  uuid,
  timestamp,
  index,
  uniqueIndex,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

/** Terminal and non-terminal states a queued job can hold. */
export const JOB_STATUSES = [
  "pending",
  "running",
  "succeeded",
  "failed",
] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** A job is finished, for better or worse, in these states. */
export const TERMINAL_JOB_STATUSES: readonly JobStatus[] = [
  "succeeded",
  "failed",
];

export const jobQueue = quillsSchema
  .table(
    "job_queue",
    {
      workspaceId: workspaceColumn(),
      /** Insertion order within a workspace — also the claim tiebreaker. */
      id: bigint("id", { mode: "bigint" })
        .generatedAlwaysAsIdentity()
        .notNull(),
      /** App-facing branded id ('job_...'), stable across attempts. */
      jobId: text("job_id").notNull(),
      /** Logical queue name; maps to exactly one registered handler. */
      queue: text("queue").notNull(),
      /** Idempotency handle. Unique per queue across every status. */
      dedupeKey: text("dedupe_key"),
      /** Workspace this row belongs to, or NULL on a single-workspace install. */
      workspaceKey: text("workspace_key"),
      payload: jsonb("payload").notNull().default({}),
      status: text("status").$type<JobStatus>().notNull().default("pending"),
      /** Earliest instant the job may be claimed. */
      runAt: timestamp("run_at", { withTimezone: true }).notNull().defaultNow(),
      /** Incremented BY THE CLAIM. See 0250_job_queue.sql. */
      attempts: integer("attempts").notNull().default(0),
      /** 1 means at-most-once: an expired lease goes terminal, never to pending. */
      maxAttempts: integer("max_attempts").notNull().default(1),
      /** Fencing token, regenerated on every claim. */
      leaseToken: uuid("lease_token"),
      lockedUntil: timestamp("locked_until", { withTimezone: true }),
      lockedBy: text("locked_by"),
      lastError: text("last_error"),
      createdAt: timestamp("created_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      updatedAt: timestamp("updated_at", { withTimezone: true })
        .notNull()
        .defaultNow(),
      startedAt: timestamp("started_at", { withTimezone: true }),
      finishedAt: timestamp("finished_at", { withTimezone: true }),
    },
    (table) => [
      uniqueIndex("job_queue_job_id_idx").on(table.workspaceId, table.jobId),
      uniqueIndex("job_queue_dedupe_idx")
        .on(table.workspaceId, table.queue, table.dedupeKey)
        .where(sql`${table.dedupeKey} IS NOT NULL`),
      index("job_queue_claim_idx")
        .on(table.queue, table.runAt, table.id)
        .where(sql`${table.status} = 'pending'`),
      index("job_queue_lease_idx")
        .on(table.lockedUntil)
        .where(sql`${table.status} = 'running'`),
      index("job_queue_terminal_idx")
        .on(table.finishedAt)
        .where(sql`${table.status} IN ('succeeded', 'failed')`),
      check(
        "job_queue_status_check",
        sql`${table.status} IN ('pending', 'running', 'succeeded', 'failed')`,
      ),
      check("job_queue_max_attempts_check", sql`${table.maxAttempts} >= 1`),
      check(
        "job_queue_lease_shape_check",
        sql`(${table.status} = 'running') = (${table.leaseToken} IS NOT NULL AND ${table.lockedUntil} IS NOT NULL)`,
      ),
      primaryKey({ columns: [table.workspaceId, table.id] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();

export type JobQueueRow = typeof jobQueue.$inferSelect;
