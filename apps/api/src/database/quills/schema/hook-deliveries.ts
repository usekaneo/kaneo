import { quillsSchema, workspaceColumn, workspacePolicy } from "../tenancy";
import { primaryKey } from "drizzle-orm/pg-core";
/**
 * Hook delivery idempotency table.
 *
 * Records every hook job outcome, keyed by the BullMQ job ID. Processing
 * rows are short leases so a crash before the side effect can recover;
 * completed rows deduplicate BullMQ replays.
 *
 * This closes a long-standing gap where worker crashes mid-handler caused
 * BullMQ to re-run the job on the next boot — re-firing webhooks (visible
 * to customers as duplicate deliveries) and re-billing OpenAI for
 * sentiment + embedding work that already completed.
 *
 * `processedAt` lets us prune rows older than the BullMQ retention window
 * (rows for completed jobs older than 24h are useless because BullMQ has
 * forgotten the job by then).
 */
import { text, timestamp, index } from "drizzle-orm/pg-core";

export const hookDeliveries = quillsSchema
  .table(
    "hook_deliveries",
    {
      workspaceId: workspaceColumn(),
      /** BullMQ job ID — primary key. Format depends on the queue, but is
       *  always a string opaque to this table. */
      jobId: text("job_id").notNull(),
      /** Hook type that processed this job (e.g. 'webhook', 'ai'). Useful
       *  for debugging + retention sweeps that target one hook type. */
      hookType: text("hook_type").notNull(),
      /** processing leases can be reclaimed after a worker crash; completed and
       * failed outcomes remain durable dedupe records. */
      outcome: text("outcome").notNull().default("completed"),
      /** Wall-clock time of the latest claim/outcome. Used for leases + pruning. */
      processedAt: timestamp("processed_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    },
    (table) => [
      // Prune query: DELETE WHERE processed_at < now() - interval '7 days'
      index("hook_deliveries_processed_at_idx").on(table.processedAt),
      primaryKey({ columns: [table.workspaceId, table.jobId] }),
      workspacePolicy(table.workspaceId),
    ],
  )
  .enableRLS();
